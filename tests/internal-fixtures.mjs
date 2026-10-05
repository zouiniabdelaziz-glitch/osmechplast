export function seedInternalFixtures(db) {
  const leadResult = db.prepare(`
    INSERT INTO leads (company, name, email, phone, service, message, language, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Beispiel GmbH',
    'Mitarbeiter Test',
    'mitarbeiter@example.test',
    '+49 000 000000',
    'turning',
    'Synthetische Anfrage für lokale Tests.',
    'de',
    'test',
    'new',
    '2026-09-25T00:00:00.000Z',
  );

  return { leadId: Number(leadResult.lastInsertRowid) };
}
