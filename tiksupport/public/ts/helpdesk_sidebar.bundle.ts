interface SiteBrandingResponse {
  message?: {
    logo?: unknown;
    site_icon?: unknown;
  };
}

const sidebarSelector = '[data-slot="sidebar"]';
const logoSelector =
  'button[aria-haspopup="menu"] > img[alt="Brand Logo"], button[aria-haspopup="menu"] > img[data-tiksupport-sidebar-logo]';

let brandLogo = "";
let siteIcon = "";

function applySidebarLogo(): void {
  document.querySelectorAll<HTMLElement>(sidebarSelector).forEach((sidebar) => {
    const image = sidebar.querySelector<HTMLImageElement>(logoSelector);
    if (!image) return;

    image.dataset.tiksupportSidebarLogo = "true";
    const isCollapsed = sidebar.dataset.state === "collapsed";
    const source = isCollapsed ? siteIcon || brandLogo : brandLogo || siteIcon;
    if (!source) return;

    image.alt = isCollapsed ? "Site icon" : "Brand Logo";
    if (image.getAttribute("src") !== source) image.setAttribute("src", source);
  });
}

const observer = new MutationObserver(applySidebarLogo);
observer.observe(document.body, {
  attributes: true,
  attributeFilter: ["data-state"],
  childList: true,
  subtree: true,
});

fetch("/api/method/kustomize.api.get_site_icon", {
  credentials: "same-origin",
})
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Site branding request failed: ${response.status}`);
    }
    return response.json() as Promise<SiteBrandingResponse>;
  })
  .then((data) => {
    if (!data.message || typeof data.message !== "object") return;
    brandLogo = typeof data.message.logo === "string" ? data.message.logo : "";
    siteIcon =
      typeof data.message.site_icon === "string" ? data.message.site_icon : "";
    applySidebarLogo();
  })
  .catch((error) => console.error("Unable to apply Helpdesk sidebar branding.", error));
