// Facts the public pages share, one copy each.

// Andrew's coaching credentials, read by the home page's coach section, its
// JSON-LD, and the programs page byline. `name` is the on-page lowercase
// voice; `formal` is the credential's own name, for structured data.
export const COACH = {
  name: 'Andrew Brough',
  credentials: [
    { name: 'usaw sports performance coach', code: 'usaw', formal: 'USAW Sports Performance Coach' },
    { name: 'crossfit level 1 trainer', code: 'cf-l1', formal: 'CrossFit Level 1 Trainer (CF-L1)' },
    { name: 'nasm certified personal trainer', code: 'nasm-cpt', formal: 'NASM Certified Personal Trainer (NASM-CPT)' },
  ],
} as const;

// The founding-dad offer's size, read by / and /programs.
export const FOUNDING_SPOTS = 20;
