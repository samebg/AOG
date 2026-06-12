// src/lib/admin.ts
//
// What this file does, plain English:
// One small helper that answers a single question: "is this email the admin?"
// The Teacher feature lets the admin write new verses into the live database,
// so it must be locked to one person. Every teacher route and the teacher page
// import this same function, so there is ONE definition of who the admin is.
//
// The admin's email lives in the ADMIN_EMAIL environment variable (never
// hard-coded), so it can be changed without touching code.

// Returns true only when the given email matches ADMIN_EMAIL. Comparison is
// case-insensitive and trims spaces so "Me@x.com " and "me@x.com" still match.
// Returns false for null/undefined emails, or if ADMIN_EMAIL isn't configured.
export function isAdmin(email: string | null | undefined): boolean {
  const admin = process.env.ADMIN_EMAIL
  if (!admin || !email) return false
  return email.trim().toLowerCase() === admin.trim().toLowerCase()
}
