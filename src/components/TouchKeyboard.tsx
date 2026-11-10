import { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Box, UnstyledButton } from "@mantine/core";
import { IconBackspace } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

// Teclado en pantalla del sitio público en modo tótem (ver useIsTotem): los tótems son Windows con
// Edge/Chrome y no hay que depender de cómo esté configurado el teclado táctil de cada equipo. Se monta
// una vez (EventLayout) y sirve a cualquier campo de texto que reciba el foco: buscador, búsqueda
// avanzada, cédula al votar. No hace falta cablear nada en cada campo: escribe en el input enfocado.

type Editable = HTMLInputElement | HTMLTextAreaElement;
type Layout = "letters" | "numbers";

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "tel", "number", "url"]);
// inputmode original del campo (antes de forzar "none"), para elegir la distribución.
const ORIGINAL_INPUTMODE_ATTR = "data-touch-keyboard-inputmode";

const LETTER_ROWS = ["1234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm-."];
const NUMBER_ROWS = ["123", "456", "789"];

const isEditable = (el: EventTarget | null): el is Editable =>
  (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled) ||
  (el instanceof HTMLTextAreaElement && !el.readOnly && !el.disabled);

// Evita que además se abra el teclado táctil de Windows: con inputmode="none" el navegador no lo
// muestra. Se guarda el valor original para saber si el campo es numérico.
const suppressSystemKeyboard = (el: Editable) => {
  if (!el.hasAttribute(ORIGINAL_INPUTMODE_ATTR)) {
    el.setAttribute(ORIGINAL_INPUTMODE_ATTR, el.getAttribute("inputmode") ?? "");
  }
  el.setAttribute("inputmode", "none");
};

const layoutFor = (el: Editable): Layout => {
  const mode = el.getAttribute(ORIGINAL_INPUTMODE_ATTR) ?? el.getAttribute("inputmode") ?? "";
  const type = el instanceof HTMLInputElement ? el.type : "";
  return ["numeric", "decimal", "tel"].includes(mode) || type === "number" || type === "tel" ? "numbers" : "letters";
};

// Escribe en un input controlado por React: asignar .value directo no dispara su onChange, así que se
// usa el setter nativo y se emite un evento "input", como si se hubiera tecleado.
const setNativeValue = (el: Editable, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

// Posición del cursor; los inputs type="number" no la exponen (null): se escribe al final.
const selectionOf = (el: Editable): [number, number, boolean] => {
  try {
    if (typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
      return [el.selectionStart, el.selectionEnd, true];
    }
  } catch {
    // Algunos tipos de input lanzan al leer la selección.
  }
  return [el.value.length, el.value.length, false];
};

const replaceRange = (el: Editable, start: number, end: number, text: string, hasSelection: boolean) => {
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  if (el.maxLength > 0 && next.length > el.maxLength) return;
  setNativeValue(el, next);
  if (hasSelection) el.setSelectionRange(start + text.length, start + text.length);
};

const typeText = (el: Editable, text: string) => {
  const [start, end, hasSelection] = selectionOf(el);
  replaceRange(el, start, end, text, hasSelection);
};

const backspace = (el: Editable) => {
  const [start, end, hasSelection] = selectionOf(el);
  if (start !== end) replaceRange(el, start, end, "", hasSelection);
  else if (start > 0) replaceRange(el, start - 1, start, "", hasSelection);
};

const KEY_HEIGHT = 76;

// `dark`: colores para el estilo "glass" del sitio público (ver PublicGlass.css).
export default function TouchKeyboard({ dark = false }: { dark?: boolean }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<Editable | null>(null);
  const [layout, setLayout] = useState<Layout>("letters");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // pointerdown llega antes que el foco: es el momento de quitar el teclado del sistema.
    const onPointerDown = (event: PointerEvent) => {
      if (isEditable(event.target)) suppressSystemKeyboard(event.target);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!isEditable(event.target)) return;
      // Por si el foco llegó sin tocar el campo (ej. al tocar su etiqueta).
      suppressSystemKeyboard(event.target);
      setTarget(event.target);
      setLayout(layoutFor(event.target));
    };
    // Al pasar de un campo a otro, focusout llega antes que focusin: se espera un instante.
    const onFocusOut = () => {
      setTimeout(() => {
        if (!isEditable(document.activeElement)) setTarget(null);
      }, 0);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      // Al desmontarse (ej. el admin lo desactiva con la página abierta) cada campo recupera su
      // inputmode original, para que el teclado del sistema vuelva a funcionar como antes.
      document.querySelectorAll(`[${ORIGINAL_INPUTMODE_ATTR}]`).forEach((el) => {
        const original = el.getAttribute(ORIGINAL_INPUTMODE_ATTR);
        if (original) el.setAttribute("inputmode", original);
        else el.removeAttribute("inputmode");
        el.removeAttribute(ORIGINAL_INPUTMODE_ATTR);
      });
    };
  }, []);

  // Mientras está abierto: espacio al final de la página para poder desplazar el contenido por encima
  // del teclado, y el campo a la vista si quedó tapado.
  useEffect(() => {
    if (!target) return;
    const height = panelRef.current?.offsetHeight ?? 0;
    const previousPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `${height}px`;
    const rect = target.getBoundingClientRect();
    const visibleBottom = window.innerHeight - height;
    if (rect.bottom > visibleBottom - 16) window.scrollBy({ top: rect.bottom - visibleBottom + 48, behavior: "smooth" });
    return () => {
      document.body.style.paddingBottom = previousPadding;
    };
  }, [target]);

  if (!target) return null;

  // Cada tecla actúa en pointerdown y cancela el comportamiento por defecto: así el campo no pierde el
  // foco (ni el cursor) al tocar el teclado, y la respuesta es inmediata.
  const press = (action: () => void) => (event: ReactPointerEvent) => {
    event.preventDefault();
    action();
  };

  const key = (label: ReactNode, action: () => void, options: { flex?: number; accent?: boolean; ariaLabel?: string } = {}) => (
    <UnstyledButton
      key={typeof label === "string" ? label : options.ariaLabel}
      aria-label={options.ariaLabel}
      onPointerDown={press(action)}
      // Teclado físico / lector de pantalla: el clic también funciona (pointerdown ya lo hizo con el dedo).
      onClick={(event) => {
        if (event.detail === 0) action();
      }}
      style={{
        flex: options.flex ?? 1,
        height: KEY_HEIGHT,
        borderRadius: 10,
        fontSize: 30,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        touchAction: "manipulation",
        backgroundColor: options.accent
          ? "var(--mantine-primary-color-filled)"
          : dark
          ? "rgba(255, 255, 255, 0.09)"
          : "#fff",
        color: options.accent ? "#fff" : dark ? "#f1f3f5" : "var(--mantine-color-dark-7)",
        border: dark ? "1px solid rgba(255, 255, 255, 0.12)" : undefined,
        boxShadow: dark ? "none" : "0 2px 0 rgba(0, 0, 0, 0.18)",
      }}
    >
      {label}
    </UnstyledButton>
  );

  const close = () => target.blur();
  const backspaceKey = key(<IconBackspace size={34} />, () => backspace(target), {
    flex: 1.5,
    ariaLabel: t("touchKeyboard.backspace"),
  });
  const rows =
    layout === "letters"
      ? LETTER_ROWS.map((row, i) => [
          ...[...row].map((char) => key(char, () => typeText(target, char))),
          ...(i === LETTER_ROWS.length - 1 ? [backspaceKey] : []),
        ])
      : [
          ...NUMBER_ROWS.map((row) => [...row].map((char) => key(char, () => typeText(target, char)))),
          [key(t("touchKeyboard.clear"), () => setNativeValue(target, "")), key("0", () => typeText(target, "0")), backspaceKey],
        ];
  const bottomRow =
    layout === "letters"
      ? [
          key(t("touchKeyboard.numbers"), () => setLayout("numbers"), { flex: 1.5 }),
          key(t("touchKeyboard.clear"), () => setNativeValue(target, ""), { flex: 1.5 }),
          key(t("touchKeyboard.space"), () => typeText(target, " "), { flex: 5 }),
          key(t("touchKeyboard.done"), close, { flex: 2, accent: true }),
        ]
      : [
          key(t("touchKeyboard.letters"), () => setLayout("letters")),
          key(t("touchKeyboard.done"), close, { flex: 2, accent: true }),
        ];

  return (
    <Box
      ref={panelRef}
      role="group"
      aria-label={t("touchKeyboard.label")}
      // Los huecos entre teclas tampoco deben quitar el foco al campo.
      onPointerDown={(event) => event.preventDefault()}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        // Por encima de los modales de Mantine (200) y por debajo del protector de pantalla (9999).
        zIndex: 1000,
        padding: "16px 16px 20px",
        backgroundColor: dark ? "rgba(12, 15, 21, 0.96)" : "rgba(222, 226, 230, 0.97)",
        borderTop: dark ? "1px solid rgba(255, 255, 255, 0.1)" : undefined,
        boxShadow: "0 -6px 24px rgba(0, 0, 0, 0.25)",
        backdropFilter: dark ? "blur(12px)" : undefined,
      }}
    >
      <Box mx="auto" style={{ maxWidth: layout === "letters" ? 1040 : 560, display: "grid", gap: 10 }}>
        {[...rows, bottomRow].map((row, i) => (
          <Box key={i} style={{ display: "flex", gap: 10 }}>
            {row}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
