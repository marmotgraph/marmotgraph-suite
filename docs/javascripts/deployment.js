// The "Deployment" tab links to the documentation of the deployment (/docs/custom, see DOCS_CUSTOM_DIR) - it is hidden
// (deployment.css) unless the deployment provides one. The result is kept for the session, so the tab doesn't flicker
// from page to page.
(() => {
  const AVAILABLE = "mg-deployment-docs";
  const KEY = "mg-deployment-docs";
  const show = () => document.documentElement.classList.add(AVAILABLE);
  const remember = (available) => {
    try {
      sessionStorage.setItem(KEY, String(available));
    } catch {
      // Without storage, the next page asks again
    }
  };

  try {
    if (sessionStorage.getItem(KEY) === "true") {
      show();
    }
  } catch {
    // Without storage, the answer of the server decides
  }

  const config = JSON.parse(document.getElementById("__config")?.textContent || "{}");
  fetch(`${config.base || "."}/custom/index.html`, { method: "HEAD", cache: "no-cache" })
    .then((response) => {
      remember(response.ok);
      if (response.ok) {
        show();
      } else {
        document.documentElement.classList.remove(AVAILABLE);
      }
    })
    .catch(() => {
      // Unknown - keep what the session knows
    });
})();
