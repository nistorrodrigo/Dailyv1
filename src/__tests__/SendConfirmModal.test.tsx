import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SendConfirmModal from "../components/SendConfirmModal";

const baseProps = {
  open: true,
  onCancel: () => {},
  onConfirm: () => {},
  total: 1234,
  domains: [
    { domain: "latinsecurities.ar", count: 800 },
    { domain: "gmail.com", count: 200 },
    { domain: "outlook.com", count: 134 },
    { domain: "hotmail.com", count: 60 },
    { domain: "yahoo.com", count: 30 },
    { domain: "icloud.com", count: 10 },
  ],
  sample: ["a@x.com", "b@y.com", "c@z.com"],
  subject: "Argentina Daily — April 29",
  // Disable the type-to-confirm gate for tests that exercise other behaviour.
  // Dedicated tests below cover the gated path.
  requireTypedConfirmation: false,
};

describe("SendConfirmModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SendConfirmModal {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("displays the recipient total prominently", () => {
    render(<SendConfirmModal {...baseProps} />);
    expect(screen.getByText(/1,234 recipients/)).toBeInTheDocument();
    // Confirm button label includes the count.
    expect(screen.getByRole("button", { name: /Confirm Send to 1,234/ })).toBeInTheDocument();
  });

  it("shows the subject and any A/B variant", () => {
    render(<SendConfirmModal {...baseProps} abSubjectB="Variant B subject" />);
    expect(screen.getByText("Argentina Daily — April 29")).toBeInTheDocument();
    expect(screen.getByText(/Variant B subject/)).toBeInTheDocument();
  });

  it("shows the source list when provided", () => {
    render(<SendConfirmModal {...baseProps} selectedListName="Wealth Mails" />);
    expect(screen.getByText("Wealth Mails")).toBeInTheDocument();
  });

  it("shows the attachment filename when provided", () => {
    render(<SendConfirmModal {...baseProps} attachmentFilename="report.pdf" />);
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
  });

  it("renders top 5 domains and groups the rest as 'other domains'", () => {
    render(<SendConfirmModal {...baseProps} />);
    // Top 5 should appear individually.
    expect(screen.getByText("latinsecurities.ar")).toBeInTheDocument();
    expect(screen.getByText("gmail.com")).toBeInTheDocument();
    expect(screen.getByText("hotmail.com")).toBeInTheDocument();
    expect(screen.getByText("yahoo.com")).toBeInTheDocument();
    // 6th domain (icloud) folded into "+ N other domains".
    expect(screen.queryByText("icloud.com")).toBeNull();
    expect(screen.getByText(/other domain/i)).toBeInTheDocument();
  });

  it("shows the sample and a 'X more' line", () => {
    render(<SendConfirmModal {...baseProps} />);
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("b@y.com")).toBeInTheDocument();
    expect(screen.getByText("c@z.com")).toBeInTheDocument();
    // total is 1234, sample.length is 3 → "and 1,231 more".
    expect(screen.getByText(/1,231 more/)).toBeInTheDocument();
  });

  it("fires onConfirm when the red Confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<SendConfirmModal {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: /Confirm Send to/ }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("fires onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<SendConfirmModal {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders an iframe preview when html is provided", () => {
    const html = "<html><body><h1>Hello</h1></body></html>";
    const { container } = render(<SendConfirmModal {...baseProps} html={html} />);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("title")).toBe("Email preview");
    expect(iframe?.getAttribute("srcdoc")).toBe(html);
  });

  it("does not render a preview when html is undefined", () => {
    const { container } = render(<SendConfirmModal {...baseProps} html={undefined} />);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("shows authenticated identity when authedAs + authMethod=session", () => {
    render(<SendConfirmModal {...baseProps} authedAs="rodrigo@latinsecurities.ar" authMethod="session" />);
    expect(screen.getByText(/Authenticated session/i)).toBeInTheDocument();
    expect(screen.getByText(/rodrigo@latinsecurities\.ar/)).toBeInTheDocument();
  });

  it("warns when there is no authentication at all", () => {
    render(<SendConfirmModal {...baseProps} authedAs={null} authMethod="none" />);
    expect(screen.getByText(/No authentication/i)).toBeInTheDocument();
    expect(screen.getByText(/log out and back in/i)).toBeInTheDocument();
  });

  it("disables the Send button until 'SEND' is typed (type-to-confirm)", () => {
    const onConfirm = vi.fn();
    render(<SendConfirmModal {...baseProps} requireTypedConfirmation onConfirm={onConfirm} />);
    const sendBtn = screen.getByRole("button", { name: /Confirm Send to/ });
    expect(sendBtn).toBeDisabled();
    fireEvent.click(sendBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    // Type the wrong word — still disabled.
    const input = screen.getByPlaceholderText("SEND");
    fireEvent.change(input, { target: { value: "yes" } });
    expect(sendBtn).toBeDisabled();

    // Type SEND (case-insensitive) — enables.
    fireEvent.change(input, { target: { value: "send" } });
    expect(sendBtn).not.toBeDisabled();
    fireEvent.click(sendBtn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
