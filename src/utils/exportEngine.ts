import * as XLSX from 'xlsx';
import { TimetableData } from '../types/timetable';
import { exportTimetableToPDF } from './pdfExport';

export { exportTimetableToPDF };

/**
 * Export timetable as formatted Excel (.xlsx) spreadsheet
 */
export function exportTimetableToExcel(timetable: TimetableData) {
  const days = timetable.days;
  const timeSlots = timetable.timeSlots;

  // 1. Grid matrix worksheet
  const matrixData: (string | number)[][] = [];
  matrixData.push(['Time Slot', ...days]);

  timeSlots.forEach((slotTime) => {
    const row: string[] = [slotTime];
    days.forEach((day) => {
      const match = timetable.slots.find((s) => s.day === day && s.timeSlot === slotTime);
      if (match) {
        if (match.isBreak) {
          row.push(`[Break] ${match.subject}`);
        } else {
          const instructor = match.teacher ? ` - ${match.teacher}` : '';
          const room = match.room ? ` [${match.room}]` : '';
          row.push(`${match.subject}${instructor}${room}`);
        }
      } else {
        row.push('-');
      }
    });
    matrixData.push(row);
  });

  const wb = XLSX.utils.book_new();
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);

  // Set column widths for readability
  wsMatrix['!cols'] = [{ wch: 18 }, ...days.map(() => ({ wch: 26 }))];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Timetable Grid');

  // 2. Linear Course List worksheet
  const flatData = timetable.slots.map((s) => ({
    Day: s.day,
    'Time Slot': s.timeSlot,
    Subject: s.subject,
    Instructor: s.teacher || 'Unassigned',
    Room: s.room || 'TBA',
    Type: s.isBreak ? 'Break' : 'Class',
  }));
  const wsList = XLSX.utils.json_to_sheet(flatData);
  wsList['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsList, 'Schedule List');

  const filename = `${timetable.semester.replace(/\s+/g, '_')}_Schedule.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Export timetable as clean Microsoft Word (.doc) document
 */
export function exportTimetableToWord(timetable: TimetableData) {
  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${timetable.semester} - Timetable</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #111; margin: 30px; }
        h1 { font-size: 18pt; margin-bottom: 4px; color: #111; font-weight: 700; }
        p.subtitle { margin-top: 0; color: #666; font-size: 11pt; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; }
        th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 10pt; vertical-align: top; }
        th { background-color: #f3f4f6; font-weight: 600; color: #374151; }
        .break { background-color: #fffbeb; font-style: italic; color: #92400e; }
        .slot-title { font-weight: 600; color: #111827; }
        .slot-meta { font-size: 9pt; color: #6b7280; margin-top: 4px; }
      </style>
    </head>
    <body>
      <h1>${timetable.semester} (${timetable.section})</h1>
      <p class="subtitle">Shift: ${timetable.shift} &bull; Days: ${timetable.days.join(', ')}</p>
      <table>
        <thead>
          <tr>
            <th style="width: 140px;">Time Slot</th>
            ${timetable.days.map((d) => `<th>${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${timetable.timeSlots
            .map(
              (ts) => `
            <tr>
              <td><strong>${ts}</strong></td>
              ${timetable.days
                .map((day) => {
                  const s = timetable.slots.find((slot) => slot.day === day && slot.timeSlot === ts);
                  if (!s) return '<td>-</td>';
                  if (s.isBreak) return `<td class="break"><em>${s.subject}</em></td>`;
                  return `<td>
                    <div class="slot-title">${s.subject}</div>
                    <div class="slot-meta">${s.teacher ? s.teacher : ''} ${s.room ? '&bull; ' + s.room : ''}</div>
                  </td>`;
                })
                .join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${timetable.semester.replace(/\s+/g, '_')}_Schedule.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print timetable directly via browser print dialog
 */
export function printTimetable(timetable: TimetableData) {
  window.print();
}
