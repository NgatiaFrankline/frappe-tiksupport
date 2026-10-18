interface ApiResponse<T> {
  message?: T | string;
  exc?: string;
  _server_messages?: string;
}

interface GoogleRecaptcha {
  getResponse(): string;
  reset(): void;
}

export function lazyLoadTicketSceneImages(): void {
  const scene = document.querySelector<HTMLElement>(".tiksupport-ticket-scene");
  if (!scene || scene.getClientRects().length === 0) return;

  const images = scene.querySelectorAll<HTMLImageElement>("img[data-src]");
  const loadImage = (image: HTMLImageElement): void => {
    const source = image.dataset.src;
    if (!source) return;
    image.addEventListener("load", () => image.classList.add("is-loaded"), { once: true });
    image.src = source;
    delete image.dataset.src;
  };

  if (typeof IntersectionObserver === "undefined") {
    images.forEach(loadImage);
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      if (entry.target instanceof HTMLImageElement) {
        loadImage(entry.target);
        currentObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "100px" });

  images.forEach((image) => observer.observe(image));
}

declare global {
  interface Window {
    grecaptcha?: GoogleRecaptcha;
  }
}

export async function callApi<T = any>(
  csrfToken: string,
  method: string,
  values: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/method/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(values),
    credentials: "same-origin",
  });
  const data: ApiResponse<T> = await response.json();
  if (!response.ok || data.exc) {
    const messages: string[] = data._server_messages ? JSON.parse(data._server_messages) : [];
    const message = messages.length ? JSON.parse(messages[0]).message : data.message;
    throw new Error((message as string) || "Request failed. Please try again.");
  }
  return data.message as T;
}

export function showMessage(element: HTMLElement, text: string, isError = false): void {
  element.replaceChildren();
  const message = document.createElement("p");
  message.className = isError ? "text-danger" : "text-success";
  message.textContent = text;
  element.append(message);
}

export function getRecaptchaToken(enabled: boolean): string {
  if (!enabled) return "";
  if (!window.grecaptcha) {
    throw new Error("reCAPTCHA is still loading. Please wait a moment and try again.");
  }

  const token = window.grecaptcha.getResponse();
  if (!token) {
    throw new Error("Please complete the reCAPTCHA checkbox.");
  }
  return token;
}

export function resetRecaptcha(enabled: boolean): void {
  if (enabled) window.grecaptcha?.reset();
}
