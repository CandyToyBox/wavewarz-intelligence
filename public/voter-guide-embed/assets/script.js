(function () {
  var storageKey = "wavewarz-voter-progress-v1";
  var contentPath = "content.json";

  function getValue(source, path) {
    return path.split(".").reduce(function (value, key) {
      return value && value[key];
    }, source);
  }

  function makeElement(tag, className, text) {
    var element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function appendText(parent, tag, className, text) {
    var element = makeElement(tag, className, text);
    parent.appendChild(element);
    return element;
  }

  function isExternalUrl(href) {
    return /^https?:\/\//i.test(href || "");
  }

  function applyLinkBehavior(link, href) {
    if (isExternalUrl(href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      return;
    }

    link.removeAttribute("target");
    link.removeAttribute("rel");
  }

  function applyButtonData(link, item) {
    link.className = "button " + (item.variant || "secondary");
    link.href = item.href || "#";
    link.textContent = item.label || "";
    applyLinkBehavior(link, item.href);

    if (item.urlKey) {
      link.setAttribute("data-url-placeholder", item.urlKey);
    }
  }

  function renderActions(parent, actions) {
    if (!parent || !actions) {
      return;
    }

    parent.textContent = "";
    actions.forEach(function (item) {
      var link = document.createElement("a");
      applyButtonData(link, item);
      parent.appendChild(link);
    });
  }

  function renderHeroActions(parent, home) {
    if (!parent || !home) {
      return;
    }

    parent.textContent = "";

    var primaryActions = makeElement("div", "hero-primary-actions");
    var utilityActions = makeElement("div", "hero-utility-actions");

    renderActions(primaryActions, home.actions.filter(function (item) {
      return item.variant === "primary";
    }));
    renderActions(utilityActions, home.actions.filter(function (item) {
      return item.variant !== "primary";
    }));

    parent.appendChild(primaryActions);

    if (home.checklistHelper) {
      var helper = makeElement("div", "hero-helper-card");
      appendText(helper, "h3", null, home.checklistHelper.title);
      appendText(helper, "p", null, home.checklistHelper.body);

      var link = document.createElement("a");
      applyButtonData(link, home.checklistHelper.action);
      helper.appendChild(link);
      parent.appendChild(helper);
    }

    parent.appendChild(utilityActions);
  }

  function renderScreenshot(section, data) {
    if (!data.screenshotLabel && !data.screenshotCaption && !data.screenshotPath) {
      return;
    }

    var figure = makeElement("figure", "screenshot-placeholder");
    var frame = makeElement("div", "screenshot-frame");
    var label = makeElement("span", null, data.screenshotLabel || data.screenshotPath);

    if (data.screenshotPath) {
      var normalizedPath = data.screenshotPath.toLowerCase();
      var image = document.createElement("img");
      image.alt = data.screenshotAlt || "";
      image.loading = "lazy";

      if (normalizedPath.indexOf("install-phantom.png") !== -1) {
        figure.classList.add("screenshot-install-phantom");
      }

      function showImage() {
        figure.classList.add("has-image");
        figure.classList.remove("is-missing");
      }

      image.addEventListener("load", showImage);
      image.addEventListener("error", function () {
        image.remove();
        figure.classList.remove("has-image");
        figure.classList.add("is-missing");
      });
      frame.appendChild(image);
      image.src = data.screenshotPath;

      if (image.complete && image.naturalWidth > 0) {
        showImage();
      }
    }

    frame.appendChild(label);
    figure.appendChild(frame);
    appendText(figure, "figcaption", null, data.screenshotCaption);
    section.appendChild(figure);
  }

  function renderHeading(section, data) {
    var heading = makeElement("div", "section-heading");
    appendText(heading, "p", "step-label", data.step);
    appendText(heading, "p", "time-estimate", data.time);
    appendText(heading, "h2", null, data.title);
    appendText(heading, "p", null, data.body);
    section.appendChild(heading);
  }

  function renderCards(section, cards) {
    if (!cards) {
      return;
    }

    var grid = makeElement("div", "lesson-grid");
    cards.forEach(function (card) {
      var article = makeElement("article", "info-card" + (card.variant ? " " + card.variant : ""));
      appendText(article, "h3", null, card.title);
      appendText(article, "p", null, card.body);
      grid.appendChild(article);
    });
    section.appendChild(grid);
  }

  function renderInstructions(section, instructions, variant) {
    if (!instructions) {
      return;
    }

    var list = makeElement("div", "instruction-list" + (variant ? " " + variant : ""));
    instructions.forEach(function (item) {
      var row = document.createElement("div");
      appendText(row, "span", "number", item.number);
      var copy = document.createElement("p");

      if (item.lead) {
        var strong = makeElement("strong", null, item.lead);
        copy.appendChild(strong);
        copy.appendChild(document.createTextNode(" "));
      }

      copy.appendChild(document.createTextNode(item.body || ""));
      row.appendChild(copy);
      list.appendChild(row);
    });
    section.appendChild(list);
  }

  function renderCallout(section, callout) {
    if (!callout) {
      return;
    }

    var element = makeElement("div", "callout" + (callout.variant ? " " + callout.variant : ""));
    appendText(element, "h3", null, callout.title);

    if (callout.body) {
      appendText(element, "p", null, callout.body);
    }

    if (callout.items) {
      var list = document.createElement("ul");
      callout.items.forEach(function (item) {
        appendText(list, "li", null, item);
      });
      element.appendChild(list);
    }

    section.appendChild(element);
  }

  function renderCallouts(section, callouts) {
    if (!callouts) {
      return;
    }

    callouts.forEach(function (callout) {
      renderCallout(section, callout);
    });
  }

  function renderDeviceChooser(section, chooser) {
    if (!chooser) {
      return;
    }

    var wrapper = makeElement("div", "device-chooser");
    appendText(wrapper, "h3", null, chooser.title);
    appendText(wrapper, "p", null, chooser.body);

    var grid = makeElement("div", "device-card-grid");
    chooser.cards.forEach(function (card) {
      var article = makeElement("article", "info-card device-card");
      appendText(article, "h3", null, card.title);

      var list = document.createElement("ul");
      card.items.forEach(function (item) {
        appendText(list, "li", null, item);
      });

      article.appendChild(list);

      if (card.action) {
        var link = document.createElement("a");
        applyButtonData(link, card.action);
        article.appendChild(link);
      }

      grid.appendChild(article);
    });

    wrapper.appendChild(grid);
    section.appendChild(wrapper);
  }

  function renderSplitPanels(section, panels) {
    if (!panels) {
      return;
    }

    var wrapper = makeElement("div", "split-panel");
    panels.forEach(function (panel) {
      var item = document.createElement("div");
      appendText(item, "h3", null, panel.title);
      appendText(item, "p", null, panel.body);
      wrapper.appendChild(item);
    });
    section.appendChild(wrapper);
  }

  function renderCompletion(section, completion) {
    if (!completion) {
      return;
    }

    var label = makeElement("label", "complete-row");
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("data-progress", completion.id);
    checkbox.setAttribute("data-progress-scope", "guide");
    label.appendChild(checkbox);
    appendText(label, "span", null, completion.label);
    section.appendChild(label);
  }

  function renderHandoff(section, handoff) {
    if (!handoff) {
      return;
    }

    appendText(section, "p", "handoff-line", handoff);
  }

  function renderMissionList(section, missions) {
    if (!missions) {
      return;
    }

    var list = makeElement("div", "mission-list");
    missions.forEach(function (mission) {
      var label = document.createElement("label");
      var checkbox = document.createElement("input");
      var text = document.createElement("span");
      checkbox.type = "checkbox";
      checkbox.setAttribute("data-progress", mission.id);
      checkbox.setAttribute("data-progress-scope", "battle");
      appendText(text, "strong", null, mission.title);
      text.appendChild(document.createTextNode(mission.body ? " " + mission.body : ""));
      label.appendChild(checkbox);
      label.appendChild(text);
      list.appendChild(label);
    });
    section.appendChild(list);
  }

  function renderFaq(section, items) {
    if (!items) {
      return;
    }

    var list = makeElement("div", "faq-list");
    items.forEach(function (item) {
      var details = document.createElement("details");
      if (item.open) {
        details.open = true;
      }
      appendText(details, "summary", null, item.question);
      appendText(details, "p", null, item.answer);
      list.appendChild(details);
    });
    section.appendChild(list);
  }

  function renderMissionComplete(section, data) {
    if (!data.checklist && !data.event) {
      return false;
    }

    section.textContent = "";

    var heading = makeElement("div", "section-heading");
    appendText(heading, "p", "step-label", data.title);
    appendText(heading, "p", "mission-complete-badge", data.badge);
    appendText(heading, "h2", null, data.subtitle);
    appendText(heading, "p", null, data.body);
    section.appendChild(heading);

    var layout = makeElement("div", "mission-complete-grid");
    var checklist = makeElement("div", "mission-complete-checklist");
    appendText(checklist, "h3", null, data.checklistTitle);

    data.checklist.forEach(function (item) {
      appendText(checklist, "p", null, "✓ " + item);
    });

    var eventCard = makeElement("article", "event-card");
    appendText(eventCard, "h3", null, data.event.title);

    data.event.details.forEach(function (detail) {
      appendText(eventCard, "p", null, detail);
    });

    var actions = makeElement("div", "section-actions");
    renderActions(actions, data.actions);
    eventCard.appendChild(actions);
    appendText(eventCard, "small", null, data.finalLine);

    layout.appendChild(checklist);
    layout.appendChild(eventCard);
    section.appendChild(layout);

    return true;
  }

  function renderSection(section, data) {
    if (renderMissionComplete(section, data)) {
      return;
    }

    section.textContent = "";
    renderHeading(section, data);
    renderDeviceChooser(section, data.deviceChooser);

    if (data.actions) {
      var actions = makeElement("div", "section-actions");
      section.appendChild(actions);
      renderActions(actions, data.actions);
    }

    renderScreenshot(section, data);
    renderCards(section, data.cards);
    renderInstructions(section, data.instructions, data.instructionVariant);
    renderCallouts(section, data.callouts);
    renderCallout(section, data.callout);
    renderSplitPanels(section, data.splitPanels);
    renderMissionList(section, data.missions);
    renderFaq(section, data.items);
    renderHandoff(section, data.handoff);
    renderCompletion(section, data.completion);
  }

  function renderContent(content) {
    document.title = content.meta.title;

    var description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", content.meta.description);
    }

    document.querySelectorAll("[data-content]").forEach(function (element) {
      element.textContent = getValue(content, element.getAttribute("data-content")) || "";
    });

    document.querySelectorAll("[data-aria-label]").forEach(function (element) {
      element.setAttribute("aria-label", getValue(content, element.getAttribute("data-aria-label")) || "");
    });

    document.querySelectorAll("[data-list]").forEach(function (element) {
      var items = getValue(content, element.getAttribute("data-list")) || [];
      element.textContent = "";

      if (element.classList.contains("top-nav")) {
        items.forEach(function (item) {
          var link = document.createElement("a");
          link.href = item.href;
          link.textContent = item.label;
          applyLinkBehavior(link, item.href);
          element.appendChild(link);
        });
        return;
      }

      if (element.classList.contains("hero-actions")) {
        renderHeroActions(element, content.home);
        return;
      }

      if (element.classList.contains("trust-strip")) {
        items.forEach(function (item) {
          appendText(element, "p", null, item);
        });
      }
    });

    Object.keys(content.sections).forEach(function (key) {
      var section = document.querySelector('[data-section="' + key + '"]');
      if (section) {
        renderSection(section, content.sections[key]);
      }
    });

    applyUrls(content.urls || {});
  }

  function applyUrls(urls) {
    document.querySelectorAll("[data-url-placeholder]").forEach(function (link) {
      var key = link.getAttribute("data-url-placeholder");
      var url = urls[key];

      if (url) {
        link.href = url;
        applyLinkBehavior(link, url);
        link.removeAttribute("aria-disabled");
      } else {
        link.href = "#";
        applyLinkBehavior(link, "#");
        link.setAttribute("aria-disabled", "true");
      }
    });
  }

  function readProgress() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch (error) {
      return {};
    }
  }

  function writeProgress(progress) {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }

  function migrateProgress(progress) {
    if (!progress["phantom-ready"] && (progress["why-wallet"] || progress["install-phantom"])) {
      progress["phantom-ready"] = true;
      writeProgress(progress);
    }

    return progress;
  }

  function calculateProgressPercent(completed, total) {
    if (!total) {
      return 0;
    }

    return Math.round((completed / total) * 100);
  }

  function updateProgress() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-progress-scope="guide"]'));
    var progressPercent = document.getElementById("progressPercent");
    var progressRing = document.querySelector(".progress-ring");
    var completed = boxes.filter(function (box) {
      return box.checked;
    }).length;
    var percent = calculateProgressPercent(completed, boxes.length);

    if (progressPercent) {
      progressPercent.textContent = percent + "%";
    }

    if (progressRing) {
      progressRing.style.setProperty("--progress", percent + "%");
      progressRing.classList.toggle("is-empty", percent === 0);
      progressRing.classList.toggle("is-complete", percent === 100);
    }
  }

  function hydrateProgress() {
    var progress = migrateProgress(readProgress());
    var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-progress]"));
    var resetButton = document.getElementById("resetProgress");

    boxes.forEach(function (box) {
      var id = box.getAttribute("data-progress");
      box.checked = Boolean(progress[id]);

      box.addEventListener("change", function () {
        var nextProgress = readProgress();
        nextProgress[id] = box.checked;
        writeProgress(nextProgress);
        updateProgress();
      });
    });

    if (resetButton) {
      resetButton.addEventListener("click", function () {
        localStorage.removeItem(storageKey);
        boxes.forEach(function (box) {
          box.checked = false;
        });
        updateProgress();
      });
    }

    updateProgress();
  }

  function loadContent() {
    if (window.location.protocol === "file:" && window.WAVEWARZ_CONTENT) {
      return Promise.resolve(window.WAVEWARZ_CONTENT);
    }

    return fetch(contentPath).then(function (response) {
      if (!response.ok) {
        throw new Error("Could not load content.json");
      }
      return response.json();
    }).catch(function (error) {
      if (window.WAVEWARZ_CONTENT) {
        console.warn("Using embedded content fallback because content.json could not be loaded.", error);
        return window.WAVEWARZ_CONTENT;
      }

      throw error;
    });
  }

  loadContent()
    .then(function (content) {
      renderContent(content);
      hydrateProgress();
    })
    .catch(function (error) {
      console.error(error);
      document.body.classList.add("content-load-error");
    });
})();
