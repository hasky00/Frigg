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
    var get = el("a", "get", (app.price_sats ? "Buy · " : "Get · ") + priceLabel(app));
    get.href = "frigg://install/" + app.id;
    var more = el("button", "more", "Details");
    more.type = "button";
    buy.appendChild(get);
    buy.appendChild(more);
    box.appendChild(buy);

    var help = el("div", "help");
    help.hidden = true;
    help.appendChild(el("span", null, "A payment window should have opened. Nothing happened? Frigg is not on this machine yet. Run this in your Omarchy terminal, then press the button again:"));
    help.appendChild(commandBox(INSTALL_LINE));
    box.appendChild(help);
    get.addEventListener("click", function () { help.hidden = false; });

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
