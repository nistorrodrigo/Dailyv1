import { generateHTML } from "./generateHTML";
import useDailyStore from "../store/useDailyStore";
import { formatDate } from "./dates";
import { toast } from "../store/useToastStore";

export async function exportPDF(): Promise<void> {
  const state = useDailyStore.getState();
  const html = generateHTML(state);

  // Open a new window with the HTML and trigger print (Save as PDF)
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Please allow popups to export PDF");
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

  // Wait for the print window to fetch the absolute-URL logo from
  // the deployed CDN before triggering print. 1500 ms is generous
  // for a ~50 KB PNG over a normal connection — previous 500 ms
  // was tuned for inline base64 (instant) and is no longer enough
  // since logos now load via HTTP.
  setTimeout(() => {
    win.print();
  }, 1500);
}
