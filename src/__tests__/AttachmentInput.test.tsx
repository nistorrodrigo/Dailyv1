import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AttachmentInput, { type EmailAttachment } from "../components/AttachmentInput";

describe("AttachmentInput", () => {
  it("does not show 'Attached:' when no attachment is present", () => {
    render(<AttachmentInput attachment={null} onChange={() => {}} />);
    expect(screen.queryByText(/Attached:/)).toBeNull();
  });

  it("shows the filename + Remove button when an attachment is present", () => {
    const att: EmailAttachment = { content: "abc", filename: "report.pdf", type: "application/pdf" };
    render(<AttachmentInput attachment={att} onChange={() => {}} />);
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("calls onChange(null) when Remove is clicked", () => {
    const onChange = vi.fn();
    const att: EmailAttachment = { content: "abc", filename: "x.pdf", type: "application/pdf" };
    render(<AttachmentInput attachment={att} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange(null) when the user clears the file input (no file selected)", () => {
    const onChange = vi.fn();
    render(<AttachmentInput attachment={null} onChange={onChange} />);
    const input = screen.getByDisplayValue("") as HTMLInputElement;
    // Simulate clearing — empty FileList. The component reads files[0]; undefined → onChange(null).
    fireEvent.change(input, { target: { files: [] } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
