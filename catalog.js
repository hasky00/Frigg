// Draws Frigg app cards from the catalog. Shared by the landing page and the store window.
(function () {
  var INSTALL_LINE = "curl -fsSL https://raw.githubusercontent.com/hasky00/Frigg/main/install.sh | bash";

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function initials(name) {
    return name.split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
  }

  function priceLabel(app) {
    return app.price_sats ? app.price_sats.toLocaleString("en-GB") + " sats" : "Free";
  }

  function copyButton(text) {
    var button = el("button", null, "Copy");
    button.type = "button";
    button.addEventListener("click", function () {
      var done = function (label) { button.textContent = label; setTimeout(function () { button.textContent = "Copy"; }, 1600); };
      try {
        navigator.clipboard.writeText(text).then(function () { done("Copied"); }, function () { done("Select it"); });
      } catch (e) { done("Select it"); }
    });
    return button;
  }

  function commandBox(text) {
    var box = el("div", "cmd");
    box.appendChild(el("code", null, text));
    box.appendChild(copyButton(text));
    return box;
  }

  // ---- paying inside the store window ---------------------------------------
  // Ask the developer's Lightning address for an invoice (LNURL-pay), draw it as
  // a real QR code, and watch until it is settled. Then hand over to the frigg
  // command on this machine, which checks the payment again and installs.

  function lnurlBase(address) {
    var parts = address.split("@");
    var scheme = parts[1].indexOf("localhost") === 0 ? "http" : "https";
    return scheme + "://" + parts[1] + "/.well-known/lnurlp/" + encodeURIComponent(parts[0]);
  }

  function getJson(url) {
    return fetch(url).then(function (res) { return res.json(); });
  }

  function requestInvoice(app) {
    return getJson(lnurlBase(app.lightning_address)).then(function (meta) {
      if (!meta.callback) throw new Error("This Lightning address did not answer.");
      var msats = app.price_sats * 1000;
      var sep = meta.callback.indexOf("?") === -1 ? "?" : "&";
      return getJson(meta.callback + sep + "amount=" + msats);
    }).then(function (reply) {
      if (!reply.pr) throw new Error(reply.reason || "The developer's wallet could not make an invoice.");
      return reply;
    });
  }

  function drawQr(target, text) {
    // Upper case lets the code use its compact mode: fewer, larger squares.
    var qr = qrcode(0, "L");
    qr.addData(text.toUpperCase(), "Alphanumeric");
    qr.make();
    target.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true });
    var svg = target.querySelector("svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Lightning invoice as a QR code");
  }

  function installLink(app, verify) {
    return "frigg://install/" + app.id + (verify ? "?verify=" + encodeURIComponent(verify) : "");
  }

  function openPay(app) {
    var back = el("div", "pay-back");
    var box = el("div", "pay");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Pay for " + app.name);
    back.appendChild(box);

    var timer = null;
    function close() {
      if (timer) clearInterval(timer);
      document.removeEventListener("keydown", onKey);
      back.remove();
    }
    function onKey(event) { if (event.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", function (event) { if (event.target === back) close(); });

    var shut = el("button", "pay-close", "Close");
    shut.type = "button";
    shut.addEventListener("click", close);
    box.appendChild(shut);

    box.appendChild(el("h3", null, app.name));
    box.appendChild(el("p", "pay-amount", app.price_sats.toLocaleString("en-GB") + " sats"));
    box.appendChild(el("p", "note", "Paid straight to " + app.lightning_address + ". Frigg takes nothing."));

    var stage = el("div", "pay-stage");
    stage.appendChild(el("p", "note", "Asking the developer's wallet for an invoice."));
    box.appendChild(stage);
    document.body.appendChild(back);
    shut.focus();

    function fallback(message) {
      stage.textContent = "";
      stage.appendChild(el("p", null, message));
      stage.appendChild(el("p", "note", "You can still pay from the terminal:"));
      var link = el("a", "get", "Pay in the terminal");
      link.href = installLink(app);
      stage.appendChild(link);
    }

    function paid(verify) {
      if (timer) clearInterval(timer);
      stage.textContent = "";
      stage.appendChild(el("p", "pay-done", "Paid. Thank you."));
      stage.appendChild(el("p", "note", "One more step: let Frigg install " + app.name + " on this machine."));
      var go = el("a", "get", "Install " + app.name);
      go.href = installLink(app, verify);
      stage.appendChild(go);
      stage.appendChild(el("p", "note", "Nothing opens? Frigg is not on this machine yet. Run this in your Omarchy terminal, then press Install again:"));
      stage.appendChild(commandBox(INSTALL_LINE));
    }

    requestInvoice(app).then(function (reply) {
      stage.textContent = "";
      var code = el("div", "pay-qr");
      drawQr(code, "lightning:" + reply.pr);
      stage.appendChild(code);
      stage.appendChild(el("p", "note", "Scan with any Lightning wallet."));

      var row = el("div", "cmd");
      row.appendChild(el("code", null, reply.pr));
      row.appendChild(copyButton(reply.pr));
      stage.appendChild(row);

      var status = el("p", "pay-wait", reply.verify ? "Waiting for your payment." : "After paying, press the button below.");
      stage.appendChild(status);

      if (reply.verify) {
        timer = setInterval(function () {
          getJson(reply.verify).then(function (state) {
            if (state && state.settled === true) paid(reply.verify);
          }).catch(function () {
            // The wallet does not let a web page watch the payment. The frigg
            // command can still check it, so offer the hand-over.
            clearInterval(timer);
            status.textContent = "After paying, press the button below.";
            var go = el("a", "get", "I have paid, install it");
            go.href = installLink(app, reply.verify);
            stage.appendChild(go);
          });
        }, 2500);
      } else {
        var manual = el("a", "get", "Pay in the terminal");
        manual.href = installLink(app);
        stage.appendChild(manual);
      }
    }).catch(function (error) {
      fallback(error && error.message ? error.message : "Could not reach the developer's wallet.");
    });
  }

  function card(app) {
    var box = el("article", "app");

    var head = el("div", "app-head");
    var icon = el("div", "icon");
    if (app.icon) {
      var img = el("img");
      img.src = app.icon;
      img.alt = "";
      icon.appendChild(img);
    } else {
      icon.textContent = initials(app.name);
    }
    head.appendChild(icon);
    var title = el("div");
    title.appendChild(el("h3", null, app.name));
    title.appendChild(el("span", "by", (app.category ? app.category + " · " : "") + "by " + app.developer));
    head.appendChild(title);
    box.appendChild(head);

    box.appendChild(el("p", "tagline", app.tagline || "Details coming from the developer."));

    // The button hands over to the frigg command on this machine, which takes
    // the payment and runs the install. Without Frigg installed nothing opens,
    // so the help underneath says how to get it.
    var buy = el("div", "buy");
    var canPayHere = app.price_sats > 0 && app.lightning_address && typeof qrcode === "function";
    var get = el("a", "get", (app.price_sats ? "Buy · " : "Get · ") + priceLabel(app));
    get.href = "frigg://install/" + app.id;
    var more = el("button", "more", "Details");
    more.type = "button";
    buy.appendChild(get);
    buy.appendChild(more);
    box.appendChild(buy);

    var help = el("div", "help");
    help.hidden = true;
    help.appendChild(el("span", null, "A Frigg window should have opened. Nothing happened? Frigg is not on this machine yet. Run this in your Omarchy terminal, then press the button again:"));
    help.appendChild(commandBox(INSTALL_LINE));
    box.appendChild(help);
    get.addEventListener("click", function (event) {
      if (canPayHere) {
        event.preventDefault();
        openPay(app);
      } else {
        help.hidden = false;
      }
    });

    var details = el("div", "details");
    details.hidden = true;
    if (app.description) details.appendChild(el("p", null, app.description));
    if (app.screenshots && app.screenshots.length) {
      var shots = el("div", "shots");
      app.screenshots.forEach(function (src) { var s = el("img"); s.src = src; s.alt = app.name + " screenshot"; shots.appendChild(s); });
      details.appendChild(shots);
    }
    if (app.features && app.features.length) {
      var ul = el("ul");
      app.features.forEach(function (f) { ul.appendChild(el("li", null, f)); });
      details.appendChild(ul);
    }
    var facts = el("div", "facts");
    if (app.version) facts.appendChild(el("span", "pill", "v" + app.version));
    if (app.built_with) facts.appendChild(el("span", "pill", app.built_with));
    if (app.hotkey) facts.appendChild(el("span", "pill", app.hotkey));
    if (app.license) facts.appendChild(el("span", "pill", app.license + " licensed"));
    if (app.lightning_address && app.price_sats) facts.appendChild(el("span", "pill", "paid to " + app.lightning_address));
    details.appendChild(facts);
    if (app.source && app.source.repo) {
      var note = el("p", "note", "Frigg downloads this app from its developer and has not reviewed it. ");
      var link = el("a", null, "Read the source");
      link.href = app.source.repo + (app.source.branch ? "/tree/" + app.source.branch + (app.source.subdir ? "/" + app.source.subdir : "") : "");
      note.appendChild(link);
      details.appendChild(note);
    }
    details.appendChild(el("p", "note", "Prefer the terminal?"));
    details.appendChild(commandBox("frigg install " + app.id));
    box.appendChild(details);

    more.addEventListener("click", function () {
      details.hidden = !details.hidden;
      more.textContent = details.hidden ? "Details" : "Hide details";
    });
    return box;
  }

  function load(list) {
    fetch("apps/index.json")
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (apps) {
        list.textContent = "";
        apps.forEach(function (app) { list.appendChild(card(app)); });
      })
      .catch(function () {
        list.textContent = "";
        list.appendChild(el("p", "note", "The catalog did not load. Reload to try again."));
      });
  }

  window.Frigg = { el: el, card: card, load: load, copyButton: copyButton };
})();
