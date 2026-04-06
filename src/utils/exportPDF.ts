import { generateHTML } from "./generateHTML";
import { getLogos } from "../constants/logos";
import useDailyStore from "../store/useDailyStore";
import { formatDate } from "./dates";

export async function exportPDF(): Promise<void> {
  // Ensure logos are loaded before generating
  await getLogos();

  const state = useDailyStore.getState();
  const html = generateHTML(state);

  // Open a new window with the HTML and trigger print (Save as PDF)
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to export PDF");
    return;
  }

  win.document.write(`
    <html>
      <head>
        <title>Argentina Daily - ${formatDate(state.date)}</title>
        <style>
          @media print {
            body { margin: 0; }
            @page { margin: 10mm; size: A4; }
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  win.document.close();

  // Wait for images to load, then print
  setTimeout(() => {
    win.print();
  }, 500);
}
