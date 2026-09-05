import { jsPDF } from 'jspdf';
import { TimetableData } from '../types/timetable';

export function exportTimetableToPDF(timetable: TimetableData, universityName = 'University Faculty of Management & Technology') {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(24, 24, 27); // Zinc 900
  doc.roundedRect(margin, margin, pageWidth - margin * 2, 22, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SCHEDURA | OFFICIAL ACADEMIC TIMETABLE', margin + 6, margin + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${universityName} • ${timetable.semester} • ${timetable.section} • Shift: ${timetable.shift}`,
    margin + 6,
    margin + 15
  );

  // Status badge
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.roundedRect(pageWidth - margin - 52, margin + 4, 46, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFLICT-FREE VERIFIED', pageWidth - margin - 50, margin + 9.5);

  const startY = margin + 28;
  const gridWidth = pageWidth - margin * 2;
  const days = timetable.days;
  const timeSlots = timetable.timeSlots;

  const dayColWidth = 26;
  const slotWidth = (gridWidth - dayColWidth) / timeSlots.length;
  const rowHeight = (pageHeight - startY - margin - 8) / (days.length + 1);

  // Time Slot Headers
  doc.setFillColor(243, 244, 246); // Gray 100
  doc.rect(margin, startY, gridWidth, rowHeight, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(margin, startY, gridWidth, rowHeight, 'S');

  doc.setTextColor(75, 85, 99);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DAY / TIME', margin + 3, startY + rowHeight / 2 + 2);

  timeSlots.forEach((slot, idx) => {
    const x = margin + dayColWidth + idx * slotWidth;
    doc.line(x, startY, x, startY + rowHeight);
    // Split "08:30 - 09:30" into two lines if needed
    const parts = slot.split(' - ');
    if (parts.length === 2) {
      doc.text(parts[0], x + slotWidth / 2, startY + rowHeight / 2 - 1, { align: 'center' });
      doc.text(parts[1], x + slotWidth / 2, startY + rowHeight / 2 + 4, { align: 'center' });
    } else {
      doc.text(slot, x + slotWidth / 2, startY + rowHeight / 2 + 2, { align: 'center' });
    }
  });

  // Rows for each day
  days.forEach((day, rIdx) => {
    const y = startY + (rIdx + 1) * rowHeight;

    // Day label
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, y, dayColWidth, rowHeight, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.rect(margin, y, dayColWidth, rowHeight, 'S');

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(day.slice(0, 3).toUpperCase(), margin + dayColWidth / 2, y + rowHeight / 2 + 2, {
      align: 'center',
    });

    // Slots for this day
    timeSlots.forEach((slot, cIdx) => {
      const x = margin + dayColWidth + cIdx * slotWidth;
      const matched = timetable.slots.find((s) => s.day === day && s.timeSlot === slot);

      if (matched?.isBreak) {
        // Break cell
        doc.setFillColor(243, 244, 246);
        doc.rect(x, y, slotWidth, rowHeight, 'F');
        doc.setDrawColor(229, 231, 235);
        doc.rect(x, y, slotWidth, rowHeight, 'S');

        doc.setTextColor(156, 163, 175);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('BREAK / RECESS', x + slotWidth / 2, y + rowHeight / 2 + 2, { align: 'center' });
      } else if (matched && matched.subject) {
        // Class cell
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, slotWidth, rowHeight, 'F');
        doc.setDrawColor(229, 231, 235);
        doc.rect(x, y, slotWidth, rowHeight, 'S');

        // Subject
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        const splitSub = doc.splitTextToSize(matched.subject, slotWidth - 4);
        doc.text(splitSub.slice(0, 2), x + slotWidth / 2, y + 5, { align: 'center' });

        // Teacher
        doc.setTextColor(75, 85, 99);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        const splitTeacher = doc.splitTextToSize(matched.teacher || 'TBA', slotWidth - 4);
        doc.text(splitTeacher[0], x + slotWidth / 2, y + rowHeight - 6, { align: 'center' });

        // Room badge
        doc.setFillColor(238, 242, 255); // Indigo 50
        doc.roundedRect(x + slotWidth / 2 - 10, y + rowHeight - 4.5, 20, 3.5, 1, 1, 'F');
        doc.setTextColor(67, 56, 202); // Indigo 700
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text(matched.room || 'R-TBA', x + slotWidth / 2, y + rowHeight - 2, { align: 'center' });
      } else {
        // Empty slot
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, slotWidth, rowHeight, 'F');
        doc.setDrawColor(243, 244, 246);
        doc.rect(x, y, slotWidth, rowHeight, 'S');

        doc.setTextColor(209, 213, 219);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text('—', x + slotWidth / 2, y + rowHeight / 2 + 2, { align: 'center' });
      }
    });
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated by Schedura Intelligent Scheduling Engine • Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} • Page 1 of 1`,
    margin,
    pageHeight - 5
  );

  const filename = `${timetable.semester.replace(/\s+/g, '_')}_${timetable.section.replace(/\s+/g, '_')}_Timetable.pdf`;
  doc.save(filename);
}
