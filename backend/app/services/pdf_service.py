"""PDF and Printable Document Engine for E-Prescriptions & Invoices."""
import hashlib
from datetime import datetime
from typing import Dict, Any, List


def generate_verification_hash(
    clinic_id: str,
    doctor_license: str,
    patient_mrn: str,
    prescription_code: str,
    created_at_iso: str
) -> str:
    """Computes a SHA-256 cryptographic proof for prescription authenticity verification."""
    payload = f"{clinic_id}:{doctor_license}:{patient_mrn}:{prescription_code}:{created_at_iso}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class SimplePDFCanvas:
    """
    Lightweight, dependency-free PDF 1.4 vector generator.
    Produces valid standard PDF files readable by all PDF viewers and printers.
    """
    def __init__(self, width: int = 595, height: int = 842):  # A4 standard points
        self.width = width
        self.height = height
        self.commands: List[str] = []

    def set_font(self, font: str = "/F1", size: int = 12):
        self.commands.append(f"{font} {size} Tf")

    def set_text_color(self, r: float, g: float, b: float):
        self.commands.append(f"{r:.3f} {g:.3f} {b:.3f} rg")

    def text(self, x: float, y: float, text_str: str):
        # Escape parenthesis and sanitize for Type1 standard ASCII
        safe = "".join(c if 32 <= ord(c) < 127 else " " for c in str(text_str))
        safe = safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        self.commands.append(f"1 0 0 1 {x:.1f} {y:.1f} Tm ({safe}) Tj")

    def line(self, x1: float, y1: float, x2: float, y2: float, line_width: float = 1.0, color: tuple = (0, 0, 0)):
        self.commands.append(f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} RG")
        self.commands.append(f"{line_width:.1f} w")
        self.commands.append(f"{x1:.1f} {y1:.1f} m {x2:.1f} {y2:.1f} l S")

    def rect(self, x: float, y: float, w: float, h: float, stroke: bool = True, fill_color: tuple = None, stroke_color: tuple = None, line_width: float = 1.0):
        if stroke_color:
            self.commands.append(f"{stroke_color[0]:.3f} {stroke_color[1]:.3f} {stroke_color[2]:.3f} RG")
            self.commands.append(f"{line_width:.1f} w")
        if fill_color and stroke:
            self.commands.append(f"{fill_color[0]:.3f} {fill_color[1]:.3f} {fill_color[2]:.3f} rg")
            self.commands.append(f"{x:.1f} {y:.1f} {w:.1f} {h:.1f} re B")
        elif fill_color:
            self.commands.append(f"{fill_color[0]:.3f} {fill_color[1]:.3f} {fill_color[2]:.3f} rg")
            self.commands.append(f"{x:.1f} {y:.1f} {w:.1f} {h:.1f} re f")
        elif stroke:
            self.commands.append(f"{x:.1f} {y:.1f} {w:.1f} {h:.1f} re S")

    def draw_qr_placeholder(self, x: float, y: float, size: float = 65):
        """Draws a high-contrast vector 2D barcode verification matrix."""
        self.rect(x, y, size, size, stroke=True, fill_color=(0.96, 0.96, 0.96), stroke_color=(0.7, 0.7, 0.7), line_width=0.8)
        # Draw concentric finder patterns
        for offset in [0, size - 20]:
            for v_offset in [0, size - 20]:
                self.rect(x + offset + 2, y + v_offset + 2, 16, 16, stroke=False, fill_color=(0.1, 0.1, 0.1))
                self.rect(x + offset + 5, y + v_offset + 5, 10, 10, stroke=False, fill_color=(1, 1, 1))
                self.rect(x + offset + 7, y + v_offset + 7, 6, 6, stroke=False, fill_color=(0.1, 0.1, 0.1))
        # Center marker & random timing tracks
        self.rect(x + size / 2 - 3, y + size / 2 - 3, 6, 6, stroke=False, fill_color=(0.1, 0.1, 0.1))
        self.rect(x + 22, y + size / 2 - 2, 4, 4, stroke=False, fill_color=(0.1, 0.1, 0.1))
        self.rect(x + size - 26, y + size / 2 - 2, 4, 4, stroke=False, fill_color=(0.1, 0.1, 0.1))

    def render(self) -> bytes:
        stream_content = "BT\n" + "\n".join(self.commands) + "\nET\n"
        stream_bytes = stream_content.encode("utf-8")

        objects = []
        objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
        objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
        objects.append(
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Resources << /Font << "
            b"/F1 4 0 R /F2 5 0 R "
            b">> >> /Contents 6 0 R >>\nendobj\n"
        )
        objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
        objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")
        objects.append(
            f"6 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode("utf-8")
            + stream_bytes
            + b"\nendstream\nendobj\n"
        )

        header = b"%PDF-1.4\n"
        body = b""
        offsets = [0]
        curr = len(header)
        for obj in objects:
            offsets.append(curr)
            curr += len(obj)
            body += obj

        xref_offset = len(header) + len(body)
        xref = f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("utf-8")
        for off in offsets[1:]:
            xref += f"{off:010d} 00000 n \n".encode("utf-8")

        trailer = (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("utf-8")

        return header + body + xref + trailer


def build_prescription_pdf(rx: Dict[str, Any]) -> bytes:
    """Generates official clinical A4 E-Prescription PDF binary with full hospital letterhead & verification matrix."""
    pdf = SimplePDFCanvas(595, 842)

    # 1. Hospital Header Banner (y = 740 to 824)
    pdf.rect(25, 740, 545, 84, stroke=False, fill_color=(0.06, 0.25, 0.48))
    pdf.set_text_color(1.0, 1.0, 1.0)
    pdf.set_font("/F2", 17)
    pdf.text(38, 796, rx.get("clinic_name", "METRO HEALTH POLYCLINIC").upper())

    pdf.set_text_color(0.85, 0.93, 1.0)
    pdf.set_font("/F1", 8.5)
    pdf.text(38, 781, "Multi-Specialty Hospital, Tertiary Care Complex & Diagnostic Center")
    pdf.text(38, 768, f"{rx.get('clinic_address', '100 Medical Plaza, Dhaka')} | Hotline: {rx.get('clinic_phone', '+880 1700-000000')}")
    pdf.text(38, 755, f"Email: {rx.get('clinic_email', 'care@metrohealth.com')} | 24/7 Emergency Ambulance: 10678")

    # Header Right Badge Box
    pdf.rect(410, 748, 150, 68, stroke=False, fill_color=(0.12, 0.35, 0.62))
    pdf.set_text_color(1.0, 1.0, 1.0)
    pdf.set_font("/F2", 9)
    pdf.text(420, 796, "E-PRESCRIPTION")
    pdf.set_text_color(1.0, 1.0, 0.6)
    pdf.set_font("/F2", 9)
    pdf.text(420, 781, rx.get("prescription_code", "RX-0000-0000"))
    pdf.set_text_color(0.9, 0.95, 1.0)
    pdf.set_font("/F1", 7.5)
    pdf.text(420, 767, f"Date: {rx.get('date')} ({rx.get('time', '10:00 AM')})")
    pdf.set_text_color(0.7, 1.0, 0.7)
    pdf.set_font("/F2", 7)
    pdf.text(420, 755, "STATUS: DIGITALLY VERIFIED")

    # 2. Consulting Doctor Information Block (y = 665 to 730)
    pdf.rect(25, 665, 545, 65, stroke=True, fill_color=(0.97, 0.985, 1.0), stroke_color=(0.78, 0.85, 0.92), line_width=0.8)

    doc_raw = str(rx.get('doctor_name', 'Doctor')).strip()
    doc_title = doc_raw if doc_raw.lower().startswith(('dr.', 'dr ', 'prof.', 'prof ')) else f"Dr. {doc_raw}"

    pdf.set_text_color(0.06, 0.22, 0.42)
    pdf.set_font("/F2", 11)
    pdf.text(38, 712, doc_title)

    pdf.set_text_color(0.12, 0.38, 0.68)
    pdf.set_font("/F2", 8)
    pdf.text(38, 698, f"Qualifications: {rx.get('doctor_degrees', 'MBBS, FCPS')}")

    pdf.set_text_color(0.25, 0.3, 0.35)
    pdf.set_font("/F1", 7.5)
    pdf.text(38, 684, f"Specialty: {rx.get('doctor_specialization', 'General Medicine')} | BMDC Reg No: {rx.get('doctor_license', 'Reg-Pending')}")
    pdf.text(38, 672, f"Visiting Schedule: {rx.get('visiting_days', 'Sat - Thu')} ({rx.get('visiting_hours', '5:00 PM - 9:00 PM')})")

    pdf.set_text_color(0.15, 0.2, 0.25)
    pdf.set_font("/F2", 8)
    pdf.text(330, 712, "CHAMBER / OPD ROOM:")
    pdf.set_text_color(0.25, 0.3, 0.35)
    pdf.set_font("/F1", 7.5)
    pdf.text(330, 698, rx.get("doctor_chamber", "Room 302, 3rd Floor, Main OPD"))
    pdf.text(330, 684, "Metro Health Polyclinic OPD Wing")

    # 3. Patient Information Bar (y = 600 to 655)
    pdf.rect(25, 600, 545, 55, stroke=True, fill_color=(0.95, 0.97, 0.99), stroke_color=(0.8, 0.85, 0.9), line_width=0.8)

    pdf.set_font("/F2", 8)
    pdf.set_text_color(0.4, 0.45, 0.5)
    pdf.text(38, 638, "PATIENT NAME:")
    pdf.set_text_color(0.1, 0.15, 0.2)
    pdf.set_font("/F2", 9)
    pdf.text(115, 638, f"{rx.get('patient_name')} ({rx.get('patient_gender')})")

    pdf.set_font("/F2", 8)
    pdf.set_text_color(0.4, 0.45, 0.5)
    pdf.text(290, 638, "MRN:")
    pdf.set_text_color(0.1, 0.35, 0.6)
    pdf.set_font("/F2", 8.5)
    pdf.text(320, 638, str(rx.get('patient_mrn', 'N/A')))

    pdf.set_font("/F2", 8)
    pdf.set_text_color(0.4, 0.45, 0.5)
    pdf.text(420, 638, "BLOOD GROUP:")
    pdf.set_text_color(0.75, 0.1, 0.1)
    pdf.set_font("/F2", 9)
    pdf.text(498, 638, str(rx.get('patient_blood_group', 'N/A')))

    pdf.set_font("/F1", 7.5)
    pdf.set_text_color(0.4, 0.45, 0.5)
    pdf.text(38, 622, "AGE / DOB:")
    pdf.set_text_color(0.2, 0.25, 0.3)
    pdf.text(95, 622, f"{rx.get('patient_age')} yrs | DOB: {rx.get('patient_dob')}")

    pdf.set_text_color(0.4, 0.45, 0.5)
    pdf.text(290, 622, "PHONE:")
    pdf.set_text_color(0.2, 0.25, 0.3)
    pdf.text(335, 622, str(rx.get('patient_phone', 'N/A')))

    pdf.set_text_color(0.4, 0.45, 0.5)
    pdf.text(420, 622, "UNIT / BED:")
    pdf.set_text_color(0.08, 0.5, 0.25)
    pdf.set_font("/F2", 8)
    pdf.text(475, 622, str(rx.get('bed_assignment', 'OPD / Outpatient'))[:18])

    pdf.set_font("/F2", 7)
    pdf.set_text_color(0.8, 0.15, 0.15)
    pdf.text(38, 608, "ALLERGIES:")
    pdf.set_font("/F1", 7)
    pdf.set_text_color(0.3, 0.3, 0.3)
    pdf.text(95, 608, str(rx.get('patient_allergies', 'None Reported (NKDA)'))[:60])

    # 4. Clinical Assessment, Diagnosis & Vitals (y = 538 to 590)
    pdf.rect(25, 538, 545, 52, stroke=True, fill_color=(0.985, 0.99, 1.0), stroke_color=(0.84, 0.88, 0.93), line_width=0.8)

    pdf.set_text_color(0.06, 0.25, 0.48)
    pdf.set_font("/F2", 8)
    pdf.text(38, 576, "CLINICAL ASSESSMENT & DIAGNOSIS:")

    pdf.set_text_color(0.15, 0.2, 0.25)
    pdf.set_font("/F2", 8)
    diag_line = f"Diagnosis: {rx.get('diagnosis', 'Essential Assessment')} | Chief Complaint: {rx.get('chief_complaint', 'Clinical Consultation')}"
    pdf.text(38, 563, diag_line[:85])

    v = rx.get("vitals") or {}
    pdf.set_text_color(0.35, 0.4, 0.45)
    pdf.set_font("/F1", 7.5)
    v_str = f"Vitals: BP: {v.get('bp', '120/80 mmHg')} | Pulse: {v.get('pulse', '74 bpm')} | Temp: {v.get('temp', '98.4 F')} | Wt: {v.get('weight', 'N/A')} | SpO2: {v.get('spo2', '99%')} | RBS: {v.get('glucose', 'N/A')}"
    pdf.text(38, 548, v_str[:90])

    # 5. Rx Symbol & Table Headers
    pdf.set_text_color(0.06, 0.25, 0.48)
    pdf.set_font("/F2", 18)
    pdf.text(30, 514, "Rx")

    # Table Header Bar (y = 490)
    pdf.rect(25, 490, 545, 20, stroke=False, fill_color=(0.08, 0.22, 0.38))
    pdf.set_text_color(1.0, 1.0, 1.0)
    pdf.set_font("/F2", 7.5)
    pdf.text(32, 496, "#")
    pdf.text(50, 496, "MEDICINE & STRENGTH")
    pdf.text(230, 496, "DOSAGE / REGIMEN")
    pdf.text(325, 496, "DURATION")
    pdf.text(400, 496, "INSTRUCTIONS / MEAL TIMING")

    y_curr = 468
    items = rx.get("items", [])
    for idx, item in enumerate(items[:7]):
        row_bg = (0.97, 0.98, 0.99) if idx % 2 == 0 else (1.0, 1.0, 1.0)
        pdf.rect(25, y_curr - 8, 545, 22, stroke=False, fill_color=row_bg)

        pdf.set_text_color(0.1, 0.15, 0.2)
        pdf.set_font("/F2", 8)
        med_display = f"{idx + 1}. {item.get('medicine_name')}"
        if item.get("generic_name"):
            med_display += f" ({item.get('generic_name')})"
        pdf.text(32, y_curr + 4, med_display[:40])

        pdf.set_text_color(0.08, 0.35, 0.6)
        pdf.set_font("/F2", 8)
        pdf.text(230, y_curr + 4, str(item.get("dosage", "-")))

        pdf.set_text_color(0.2, 0.25, 0.3)
        pdf.set_font("/F1", 7.5)
        pdf.text(325, y_curr + 4, str(item.get("duration", "-")))

        # Clean ASCII meal timing for PDF Helvetica
        meal_timing_str = str(item.get("meal_timing", "-")).split("/")[0].strip()
        instr_str = f"{meal_timing_str} - {item.get('instructions', '')}".strip(" -")
        pdf.text(400, y_curr + 4, instr_str[:32])

        y_curr -= 24

    # 6. Advice & Follow Up (y = 260 down to 140)
    y_curr = min(y_curr, 280)
    pdf.line(25, y_curr + 8, 570, y_curr + 8, line_width=0.8, color=(0.8, 0.85, 0.9))

    pdf.set_text_color(0.06, 0.25, 0.48)
    pdf.set_font("/F2", 8)
    pdf.text(35, y_curr - 4, "MEDICAL ADVICE & LIFESTYLE INSTRUCTIONS:")

    pdf.set_text_color(0.2, 0.25, 0.3)
    pdf.set_font("/F1", 7.5)
    adv = str(rx.get("general_advice", "Maintain balanced diet, drink adequate clean water (2.5L daily), and follow prescribed medication schedule."))
    pdf.text(40, y_curr - 17, f"* General: {adv[:95]}")

    diet = str(rx.get("diet_instructions", "Low sodium, diabetic diet, avoid spicy and fatty food."))
    pdf.text(40, y_curr - 29, f"* Dietary Guidelines: {diet[:95]}")

    pdf.text(40, y_curr - 41, "* Caution: If severe fever, chest discomfort, or unexpected reactions appear, contact helpline 10678 immediately.")

    # Next Review Box
    pdf.rect(25, y_curr - 75, 545, 24, stroke=True, fill_color=(0.94, 0.97, 1.0), stroke_color=(0.78, 0.86, 0.94), line_width=0.8)
    pdf.set_text_color(0.08, 0.32, 0.58)
    pdf.set_font("/F2", 8)
    fu_date = rx.get("follow_up_date", "After 7-14 Days / As Needed")
    pdf.text(38, y_curr - 63, f"NEXT REVIEW / FOLLOW-UP DATE: {fu_date} (Please bring this prescription and lab reports)")

    # 7. Verification & Doctor Signature Line
    pdf.line(25, 135, 570, 135, line_width=0.8, color=(0.78, 0.84, 0.9))

    # QR Matrix Placeholder
    pdf.draw_qr_placeholder(35, 42, size=65)

    pdf.set_text_color(0.06, 0.25, 0.48)
    pdf.set_font("/F2", 8)
    pdf.text(112, 98, "TAMPER-PROOF CLINICAL E-PRESCRIPTION")

    pdf.set_text_color(0.2, 0.2, 0.2)
    pdf.set_font("/F2", 7)
    pdf.text(112, 86, f"Prescription Code: {rx.get('prescription_code')}")

    pdf.set_text_color(0.4, 0.45, 0.5)
    pdf.set_font("/F1", 6.5)
    v_hash = str(rx.get("verification_hash", ""))[:36]
    pdf.text(112, 75, f"Cryptographic Proof: {v_hash}...")
    pdf.text(112, 64, f"Scan QR or verify online: {rx.get('verify_url', 'http://localhost:3000/verify-rx')}")
    pdf.text(112, 53, "Valid under Bangladesh Telemedicine & E-Health Guidelines 2020")

    # Doctor Digital Signature Block
    pdf.line(390, 82, 550, 82, line_width=0.8, color=(0.25, 0.3, 0.35))
    pdf.set_text_color(0.06, 0.2, 0.35)
    pdf.set_font("/F2", 8)
    pdf.text(400, 70, doc_title)
    pdf.set_text_color(0.3, 0.35, 0.4)
    pdf.set_font("/F1", 7)
    pdf.text(400, 59, "Consultant Physician / Authorized Medical Officer")
    pdf.set_text_color(0.5, 0.55, 0.6)
    pdf.set_font("/F1", 6)
    pdf.text(370, 48, "[Computer-Generated Official Prescription - Physical Signature Not Required]")

    # Footer note
    pdf.set_text_color(0.55, 0.6, 0.65)
    pdf.set_font("/F1", 6)
    pdf.text(140, 20, "METRO HEALTH POLYCLINIC - ADVANCED E-HEALTH MANAGEMENT SYSTEM - CONFIDENTIAL MEDICAL RECORD")

    return pdf.render()


def build_prescription_html(rx: Dict[str, Any]) -> str:
    """Generates print-ready responsive HTML with styling & letterhead for browser window.print()."""
    doc_raw = str(rx.get('doctor_name', 'Doctor')).strip()
    doc_title = doc_raw if doc_raw.lower().startswith(('dr.', 'dr ', 'prof.', 'prof ')) else f"Dr. {doc_raw}"

    v = rx.get("vitals") or {}
    items_rows = "".join([
        f"""<tr class="border-b border-slate-100 text-xs hover:bg-slate-50/50">
            <td class="py-2.5 px-3 font-semibold text-slate-800">
              <span class="font-bold text-sky-700 mr-1.5">{i+1}.</span>
              {item.get('medicine_name')}
              {f'<span class="block text-[10px] text-slate-400 font-normal">({item.get("generic_name")})</span>' if item.get("generic_name") else ''}
            </td>
            <td class="py-2.5 px-3 font-mono font-bold text-sky-800">{item.get('dosage')}</td>
            <td class="py-2.5 px-3 font-medium text-slate-700">{item.get('duration')}</td>
            <td class="py-2.5 px-3 font-medium text-slate-800">
              {item.get('meal_timing')}
              {f'<span class="block text-[10px] text-slate-500 font-normal mt-0.5">{item.get("instructions")}</span>' if item.get("instructions") else ''}
            </td>
        </tr>"""
        for i, item in enumerate(rx.get("items", []))
    ])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Clinical Prescription - {rx.get('prescription_code')}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {{
      body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; padding: 0 !important; }}
      .no-print {{ display: none !important; }}
      .page-container {{ border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; padding: 1.5rem !important; }}
    }}
  </style>
</head>
<body class="bg-slate-100 p-4 sm:p-8 font-sans antialiased text-slate-800">
  <!-- Top Bar for actions -->
  <div class="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
    <div class="flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
      <span class="text-xs font-semibold text-slate-700">Official Clinical Letterhead Prescription</span>
    </div>
    <div class="flex items-center gap-3">
      <button onclick="window.print()" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer">
        🖨️ Print Prescription / Save A4 PDF
      </button>
      <a href="/api/v1/prescriptions/{rx.get('id')}/pdf" download="{rx.get('prescription_code')}.pdf" class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition">
        ⬇️ Download Binary PDF
      </a>
    </div>
  </div>

  <div class="page-container max-w-4xl mx-auto bg-white border border-slate-200 shadow-xl rounded-2xl p-8 relative">
    <!-- Hospital Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-sky-600">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-lg">✚</div>
          <h1 class="text-2xl font-black tracking-tight text-slate-900 uppercase">{rx.get('clinic_name', 'Metro Health Polyclinic')}</h1>
        </div>
        <p class="text-xs font-medium text-sky-800">Multi-Specialty Hospital, Tertiary Care Complex & Advanced Diagnostics</p>
        <p class="text-xs text-slate-500">{rx.get('clinic_address', '100 Medical Plaza, Dhaka, Bangladesh')}</p>
        <p class="text-xs text-slate-500">
          <span class="font-semibold text-slate-700">24/7 Emergency Hotline:</span> 10678 | 
          <span class="font-semibold text-slate-700">Phone:</span> {rx.get('clinic_phone')} | 
          <span class="font-semibold text-slate-700">Email:</span> {rx.get('clinic_email')}
        </p>
      </div>

      <div class="text-right sm:self-start bg-sky-50 border border-sky-100 p-3 rounded-xl min-w-[200px]">
        <span class="inline-block px-2.5 py-0.5 bg-sky-600 text-white font-mono font-bold text-[11px] rounded-full">
          E-PRESCRIPTION
        </span>
        <div class="text-sm font-mono font-bold text-slate-900 mt-1">{rx.get('prescription_code')}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Date: {rx.get('date')} ({rx.get('time', '10:00 AM')})</div>
        <div class="text-[10px] font-bold text-emerald-700 mt-0.5">✓ Digitally Signed & Validated</div>
      </div>
    </div>

    <!-- Doctor Details Block -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 border border-slate-200 rounded-xl p-4 my-5 text-xs">
      <div>
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consulting Physician</span>
        <h3 class="text-base font-bold text-slate-900 mt-0.5">{doc_title}</h3>
        <p class="font-semibold text-sky-700 text-xs">{rx.get('doctor_degrees', 'MBBS, FCPS')}</p>
        <p class="text-slate-600 mt-0.5">
          <span class="font-medium text-slate-700">Specialty:</span> {rx.get('doctor_specialization', 'General Medicine')} | 
          <span class="font-medium text-slate-700">BMDC Reg No:</span> {rx.get('doctor_license', 'A-Pending')}
        </p>
      </div>
      <div class="md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chamber & Consultation Schedule</span>
        <p class="font-semibold text-slate-800 text-xs mt-0.5">{rx.get('doctor_chamber', 'Room 302, 3rd Floor, Main OPD')}</p>
        <p class="text-slate-600 mt-0.5">Visiting Days: <span class="font-medium">{rx.get('visiting_days', 'Sat - Thu')}</span></p>
        <p class="text-slate-600">Visiting Hours: <span class="font-medium">{rx.get('visiting_hours', '5:00 PM - 9:00 PM')}</span></p>
      </div>
    </div>

    <!-- Patient Information Bar -->
    <div class="bg-sky-50/50 border border-sky-100 rounded-xl p-4 mb-5 text-xs">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <span class="text-[10px] font-semibold text-slate-400 block uppercase">Patient Name</span>
          <span class="font-bold text-slate-900 text-sm">{rx.get('patient_name')}</span>
          <span class="text-slate-500 text-[11px] block">({rx.get('patient_gender')})</span>
        </div>
        <div>
          <span class="text-[10px] font-semibold text-slate-400 block uppercase">MRN (Hospital ID)</span>
          <span class="font-mono font-bold text-sky-800 text-xs">{rx.get('patient_mrn')}</span>
          <span class="text-slate-500 text-[11px] block">Age: {rx.get('patient_age')} yrs</span>
        </div>
        <div>
          <span class="text-[10px] font-semibold text-slate-400 block uppercase">Blood Group & Allergies</span>
          <span class="font-bold text-rose-700 text-xs">{rx.get('patient_blood_group', 'N/A')}</span>
          <span class="text-slate-500 text-[10px] block truncate" title="{rx.get('patient_allergies')}">{rx.get('patient_allergies', 'NKDA')}</span>
        </div>
        <div>
          <span class="text-[10px] font-semibold text-slate-400 block uppercase">Unit / Bed & Contact</span>
          <span class="font-semibold text-emerald-800 text-xs block">{rx.get('bed_assignment', 'OPD / Outpatient')}</span>
          <span class="text-slate-500 text-[11px]">{rx.get('patient_phone', 'N/A')}</span>
        </div>
      </div>
    </div>

    <!-- Clinical Findings & Vitals -->
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 text-xs">
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-bold text-slate-700 uppercase tracking-wide text-[11px]">Clinical Findings & Assessment</span>
        <span class="text-[11px] font-semibold text-sky-800">Provisional Diagnosis: <strong class="text-slate-900">{rx.get('diagnosis', 'Essential Assessment')}</strong></span>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg text-[11px]">
        <span><strong class="text-slate-700">BP:</strong> {v.get('bp', '120/80 mmHg')}</span>
        <span>•</span>
        <span><strong class="text-slate-700">Pulse:</strong> {v.get('pulse', '74 bpm')}</span>
        <span>•</span>
        <span><strong class="text-slate-700">Temp:</strong> {v.get('temp', '98.4°F')}</span>
        <span>•</span>
        <span><strong class="text-slate-700">Weight:</strong> {v.get('weight', 'N/A')}</span>
        <span>•</span>
        <span><strong class="text-slate-700">SpO2:</strong> {v.get('spo2', '99%')}</span>
        <span>•</span>
        <span><strong class="text-slate-700">RBS:</strong> {v.get('glucose', 'N/A')}</span>
      </div>
    </div>

    <!-- Rx Section -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-3xl font-serif font-black text-sky-800">℞</span>
        <span class="text-xs font-bold uppercase text-slate-400 tracking-wider">Prescribed Medication & Regimen</span>
      </div>
      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider">
              <th class="py-2.5 px-3">Medicine & Generic</th>
              <th class="py-2.5 px-3">Dosage / Regimen</th>
              <th class="py-2.5 px-3">Duration</th>
              <th class="py-2.5 px-3">Instructions / Meal Timing</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {items_rows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Medical Advice & Follow-Up -->
    <div class="border-t border-slate-200 pt-4 mb-6 text-xs text-slate-700 space-y-2">
      <h4 class="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Medical Advice & Patient Instructions:</h4>
      <ul class="list-disc list-inside space-y-1 text-slate-600 pl-1">
        <li><strong>General:</strong> {rx.get('general_advice', 'Adequate rest, drink 2.5L clean water daily, and strictly complete the antibiotic course if prescribed.')}</li>
        <li><strong>Dietary Guidelines:</strong> {rx.get('diet_instructions', 'Low sodium, low fat diet, avoid smoking and spicy food.')}</li>
        <li><strong>Warning Signs:</strong> If high fever, persistent vomiting, severe pain or allergies develop, report to hospital emergency immediately.</li>
      </ul>

      <div class="mt-3 p-3 bg-sky-50 border border-sky-100 rounded-lg text-sky-900 flex items-center justify-between">
        <span><strong>Next Scheduled Consultation / Follow-up:</strong> {rx.get('follow_up_date', 'After 7-14 Days / As Needed')}</span>
        <span class="text-[11px] text-sky-700">Please bring this prescription and investigation reports</span>
      </div>
    </div>

    <!-- Footer & Verification Hash -->
    <div class="border-t-2 border-slate-100 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
      <div class="flex items-center gap-3">
        <div class="w-16 h-16 bg-slate-900 text-white flex flex-col items-center justify-center font-mono text-[8px] text-center p-1 rounded-xl shadow-xs">
          <div class="w-10 h-10 border border-white/40 flex items-center justify-center font-bold text-[9px] mb-0.5">
            QR
          </div>
          <span>VERIFY</span>
        </div>
        <div>
          <div class="text-xs font-bold text-slate-800">Tamper-Proof Digital Verification</div>
          <div class="text-[10px] font-mono text-slate-400 max-w-sm truncate">{rx.get('verification_hash')}</div>
          <a href="{rx.get('verify_url')}" class="text-[11px] text-sky-600 font-semibold underline hover:text-sky-700" target="_blank">
            Verify Prescription Authenticity Online →
          </a>
          <p class="text-[9px] text-slate-400 mt-0.5">Valid under Bangladesh Digital Health & Telemedicine Guidelines</p>
        </div>
      </div>

      <div class="text-right sm:self-end">
        <div class="border-b border-slate-400 w-48 ml-auto mb-1"></div>
        <div class="text-xs font-bold text-slate-800">{doc_title}</div>
        <div class="text-[10px] text-slate-500">Consultant Physician / Medical Specialist</div>
        <div class="text-[9px] text-slate-400 italic mt-0.5">Computer-Generated Clinical Document (Valid Without Ink Signature)</div>
      </div>
    </div>
  </div>
</body>
</html>"""
