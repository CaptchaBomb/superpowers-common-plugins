import * as async from "async";
import * as marked from "marked";

let data: {
  projectClient: SupClient.ProjectClient;
};

const socket = SupClient.connect(SupClient.query.project);
socket.on("welcome", onWelcome);
socket.on("disconnect", SupClient.onDisconnected);

let loaded = false;
let initialSection: string;
window.addEventListener("message", (event: any) => {
  if (event.data.type === "setState") {
    if (!loaded) initialSection = event.data.state.section;
    else openDocumentation(event.data.state.section);
  }
});

function onWelcome() {
  data = { projectClient: new SupClient.ProjectClient(socket), };

  loadPlugins();
}

function loadPlugins() {
  SupClient.fetch(`/systems/${SupCore.system.id}/plugins.json`, "json", (err: Error, pluginsInfo: SupCore.PluginsInfo) => {
    async.each(pluginsInfo.list, (pluginName, pluginCallback) => {
      const pluginPath = `/systems/${SupCore.system.id}/plugins/${pluginName}`;
      const documentationScript = document.createElement("script") as HTMLScriptElement;
      documentationScript.addEventListener("load", () => { pluginCallback(); } );
      documentationScript.addEventListener("error", () => { pluginCallback(); } );
      documentationScript.src = `${pluginPath}/bundles/documentation.js`;
      document.body.appendChild(documentationScript);
    }, (err) => { setupDocs(); });
  });
}

const navListElt = document.querySelector("nav ul");
const mainElt =  document.querySelector("main");

mainElt.addEventListener("click", (event) => {
  const target = event.target as HTMLAnchorElement;
  if (target.tagName !== "A") return;

  event.preventDefault();
  SupApp.openLink(target.href);
});

function openDocumentation(name: string) {
  (navListElt.querySelector("li a.active") as HTMLAnchorElement).classList.remove("active");
  (mainElt.querySelector("article.active") as HTMLElement).classList.remove("active");
  navListElt.querySelector(`[data-name=${name}]`).classList.add("active");
  document.getElementById(`documentation-${name}`).classList.add("active");
}

function setupDocs() {
  const sortedNames = Object.keys(SupClient.getPlugins<SupClient.DocumentationPlugin>("documentation"));
  sortedNames.sort((a, b) => { return (a.toLowerCase() < b.toLowerCase()) ? -1 : 1; });

  const languageCode = SupClient.cookies.get("supLanguage");

  sortedNames.forEach((name) => {
    const liElt = document.createElement("li");
    const anchorElt = document.createElement("a");
    anchorElt.dataset["name"] = name;
    anchorElt.href = `#${name}`;
    liElt.appendChild(anchorElt);
    navListElt.appendChild(liElt);

    const articleElt = document.createElement("article");
    articleElt.id = `documentation-${name}`;
    mainElt.appendChild(articleElt);

    function onDocumentationLoaded(content: string) {
      articleElt.innerHTML = marked(content);
      anchorElt.textContent = articleElt.firstElementChild.textContent;

      if (SupApp == null) {
        const linkElts = articleElt.querySelectorAll("a") as any as HTMLAnchorElement[];
        for (const linkElt of linkElts) linkElt.target = "_blank";
      }
    }

    const pluginPath = SupClient.getPlugins<SupClient.DocumentationPlugin>("documentation")[name].path;
    SupClient.fetch(`${pluginPath}/documentation/${name}.${languageCode}.md`, "text", (err, data) => {
      if (err != null) {
        SupClient.fetch(`${pluginPath}/documentation/${name}.en.md`, "text", (err, data) => {
          onDocumentationLoaded(data);
        });
        return;
      }
      onDocumentationLoaded(data);
    });
  });

  navListElt.addEventListener("click", (event: any) => {
    if (event.target.tagName !== "A") return;
    openDocumentation(event.target.dataset["name"]);
  });

  (<HTMLAnchorElement>navListElt.querySelector("li a")).classList.add("active");
  (<HTMLElement>mainElt.querySelector("article")).classList.add("active");
  loaded = true;
  if (initialSection != null) openDocumentation(initialSection);
}
