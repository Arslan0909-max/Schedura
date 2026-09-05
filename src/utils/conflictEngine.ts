import { TimetableSlot, Conflict } from '../types/timetable';

export const UNIVERSITY_ROOMS = [
  'R-11',
  'R-12',
  'R-13',
  'R-14',
  'R-15',
  'R-16',
  'R-17',
  'R-18',
  'Lab-01',
  'Lab-02',
  'Seminar Hall A',
  'Auditorium B',
];

/**
 * Validates a single proposed slot against the entire global memory of slots.
 */
export function checkSlotConflict(
  proposed: TimetableSlot,
  allSlots: TimetableSlot[],
  ignoreSlotId?: string
): Conflict[] {
  if (proposed.isBreak) return [];

  const conflicts: Conflict[] = [];

  for (const existing of allSlots) {
    if (existing.id === (ignoreSlotId || proposed.id)) continue;
    if (existing.isBreak) continue;

    // Check same day and time slot
    if (existing.day === proposed.day && existing.timeSlot === proposed.timeSlot) {
      // 1. Teacher Double-Booking
      if (
        proposed.teacher &&
        existing.teacher &&
        existing.teacher.trim().toLowerCase() === proposed.teacher.trim().toLowerCase()
      ) {
        conflicts.push({
          id: `conflict-teacher-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'teacher',
          severity: 'critical',
          title: `Teacher Double-Booking: ${proposed.teacher}`,
          description: `${proposed.teacher} is already assigned to ${existing.semester} (${existing.section}) in ${existing.room} on ${existing.day} at ${existing.timeSlot}.`,
          slot1: proposed,
          slot2: existing,
          suggestedResolution: `Reassign ${proposed.subject} to an alternate time slot or swap teacher.`,
        });
      }

      // 2. Room Double-Booking
      if (
        proposed.room &&
        existing.room &&
        existing.room.trim().toLowerCase() === proposed.room.trim().toLowerCase() &&
        // If it's different semester or different section
        !(
          existing.semester.trim().toLowerCase() === proposed.semester.trim().toLowerCase() &&
          existing.section.trim().toLowerCase() === proposed.section.trim().toLowerCase()
        )
      ) {
        const availableRooms = getAvailableRooms(existing.day, existing.timeSlot, allSlots, proposed.room);
        const altRoom = availableRooms.length > 0 ? availableRooms[0] : 'R-16';

        conflicts.push({
          id: `conflict-room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'room',
          severity: 'critical',
          title: `Room Collision: ${proposed.room}`,
          description: `Room ${proposed.room} is already reserved by ${existing.semester} (${existing.section}) for "${existing.subject}" on ${existing.day} at ${existing.timeSlot}.`,
          slot1: proposed,
          slot2: existing,
          suggestedResolution: `Switch room from ${proposed.room} to available room ${altRoom}.`,
        });
      }

      // 3. Same Section Multiple Classes
      if (
        existing.semester.trim().toLowerCase() === proposed.semester.trim().toLowerCase() &&
        existing.section.trim().toLowerCase() === proposed.section.trim().toLowerCase() &&
        existing.subject !== proposed.subject
      ) {
        conflicts.push({
          id: `conflict-section-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'section',
          severity: 'critical',
          title: `Section Overlap for ${proposed.section}`,
          description: `${proposed.semester} (${proposed.section}) already has "${existing.subject}" scheduled at this exact time (${proposed.timeSlot}).`,
          slot1: proposed,
          slot2: existing,
          suggestedResolution: `Move "${proposed.subject}" to an empty time slot on ${proposed.day}.`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Finds rooms available on a given day and time slot
 */
export function getAvailableRooms(
  day: string,
  timeSlot: string,
  allSlots: TimetableSlot[],
  excludeRoom?: string
): string[] {
  const bookedRooms = new Set(
    allSlots
      .filter((s) => s.day === day && s.timeSlot === timeSlot && !s.isBreak && s.room)
      .map((s) => s.room.trim().toLowerCase())
  );

  return UNIVERSITY_ROOMS.filter((r) => {
    const isBooked = bookedRooms.has(r.toLowerCase());
    const isExcluded = excludeRoom && r.toLowerCase() === excludeRoom.toLowerCase();
    return !isBooked && !isExcluded;
  });
}

/**
 * Scans all slots across global memory and returns all active conflicts
 */
export function scanAllConflicts(allSlots: TimetableSlot[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const checkedPairs = new Set<string>();

  for (let i = 0; i < allSlots.length; i++) {
    for (let j = i + 1; j < allSlots.length; j++) {
      const s1 = allSlots[i];
      const s2 = allSlots[j];

      if (s1.isBreak || s2.isBreak) continue;
      if (s1.day !== s2.day || s1.timeSlot !== s2.timeSlot) continue;

      const pairKey = [s1.id, s2.id].sort().join(':');
      if (checkedPairs.has(pairKey)) continue;

      // Teacher clash
      if (s1.teacher && s2.teacher && s1.teacher.trim().toLowerCase() === s2.teacher.trim().toLowerCase()) {
        checkedPairs.add(pairKey);
        conflicts.push({
          id: `conflict-t-${pairKey}`,
          type: 'teacher',
          severity: 'critical',
          title: `Teacher Clash: ${s1.teacher}`,
          description: `${s1.teacher} is scheduled simultaneously in ${s1.semester} (${s1.section}, Room ${s1.room}) and ${s2.semester} (${s2.section}, Room ${s2.room}) on ${s1.day} at ${s1.timeSlot}.`,
          slot1: s1,
          slot2: s2,
          suggestedResolution: `Move one of the sessions to a free time slot.`,
        });
      }

      // Room clash
      if (
        s1.room &&
        s2.room &&
        s1.room.trim().toLowerCase() === s2.room.trim().toLowerCase() &&
        !(s1.semester === s2.semester && s1.section === s2.section)
      ) {
        checkedPairs.add(pairKey);
        const freeRooms = getAvailableRooms(s1.day, s1.timeSlot, allSlots, s1.room);
        const suggestion = freeRooms.length > 0 ? `Auto-assign room ${freeRooms[0]}` : `Pick another room.`;

        conflicts.push({
          id: `conflict-r-${pairKey}`,
          type: 'room',
          severity: 'critical',
          title: `Room Collision: ${s1.room}`,
          description: `Room ${s1.room} has been double-booked by ${s1.semester} (${s1.section}) and ${s2.semester} (${s2.section}) on ${s1.day} at ${s1.timeSlot}.`,
          slot1: s1,
          slot2: s2,
          suggestedResolution: suggestion,
        });
      }
    }
  }

  return conflicts;
}
