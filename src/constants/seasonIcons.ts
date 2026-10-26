/**
 * One symbol for each set of Learn & Study's seasons (Coptic Vine design,
 * "Season icons"): 24 × 24, a 1.6 stroke with round caps and joins, drawn in
 * `currentColor`. Inside a season's roundel, and faded on its tile, the icon is
 * white, except on the Holy Fifty Days' pale colours, where it takes the dark
 * text colour.
 */

export type SeasonIconKey =
  | 'psalmody'
  | 'incense'
  | 'liturgy'
  | 'veneration'
  | 'joyful'
  | 'nayrouz'
  | 'cross'
  | 'kiahk'
  | 'nativity'
  | 'theophany'
  | 'jonah'
  | 'lent'
  | 'palm'
  | 'holyweek'
  | 'holy50'
  | 'apostles'
  | 'marian';

export const SEASON_ICONS: Record<SeasonIconKey, string> = {
  /** Annual Psalmody. David's harp, for the psalms the praise is built on. */
  psalmody: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 5.6V20.5M4 20.5h5"/><path d="M5.5 5.6C8 3.2 11 3.6 13.2 5.6s3.6 3 5.6 2.8L7 20.5"/><path d="M8.5 5.3V17.6M11 5.2V15M13.5 6.9v5.6M16 8.6v1.3" stroke-width="1.1"/><circle cx="5.5" cy="4.3" r=".9" fill="currentColor" stroke="none"/></svg>',
  /** Raising of Incense. The censer, offered at evening and morning incense. */
  incense: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.4v2.7"/><ellipse cx="12" cy="5.6" rx="2.3" ry=".8" fill="currentColor" stroke="none"/><path d="M10.2 5.9 6.4 15M13.8 5.9 17.6 15M12 6v1.6" stroke-width="1.1"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/><path d="M8.6 13.4c0-2.2 1.8-2.9 2.5-4.4h1.8c.7 1.5 2.5 2.2 2.5 4.4z" fill="currentColor" stroke="none"/><path d="M5.8 15h12.4"/><path d="M6.4 15c0 2.8 2.4 4.6 5.6 4.6s5.6-1.8 5.6-4.6"/><path d="M10.8 19.6l-.9 1.6h4.2l-.9-1.6"/></svg>',
  /** Liturgy. The chalice, and the paten under its dome. */
  liturgy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 20.5h19"/><path d="M3 5.5h6c0 3.2-1.3 5.6-3 5.6S3 8.7 3 5.5z"/><path d="M6 11.1v7M5.1 14.3h1.8"/><path d="M3.8 20.5c.3-1.5 1.1-2.4 2.2-2.4s1.9.9 2.2 2.4"/><path d="M10.5 18.3h11l-1.2 2.2h-8.6z"/><path d="M11.5 18.3c0-2.6 2-4.4 4.5-4.4s4.5 1.8 4.5 4.4M14.6 18.3c0-2.6.6-4.4 1.4-4.4s1.4 1.8 1.4 4.4"/><path d="M16 13.9v-2.6M14.8 12.4h2.4"/></svg>',
  /** Veneration. A candle, lit before the icons of the saints. */
  veneration: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.2c1.5 1.8 2.3 3.3 2.3 4.5a2.3 2.3 0 0 1-4.6 0c0-1.2.8-2.7 2.3-4.5z"/><path d="M12 9v1.2"/><path d="M9.2 21.4V11c0-.3.3-.6.6-.6h4.4c.3 0 .6.3.6.6v10.4z"/><path d="M13 10.6v3"/></svg>',
  /** Joyful 29th. A calendar leaf with a star: the monthly feast of the Annunciation, Nativity and Resurrection. */
  joyful: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 9.5h17"/><path d="m12 11.4 1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"/></svg>',
  /** Feast of Nayrouz. A crown: God crowns the year with His goodness, and the martyrs receive theirs. */
  nayrouz: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0 .6)"><path d="M4.6 15.8 4 9Q4.3 12.6 6 12.6 7.7 12.6 8 8.2 8.3 12.2 10 12.2 11.7 12.2 12 6.6 12.3 12.2 14 12.2 15.7 12.2 16 8.2 16.3 12.6 18 12.6 19.7 12.6 20 9L19.4 15.8Q12 14.2 4.6 15.8Z"/><path d="M4.6 15.8 4.9 19.8Q12 18.2 19.1 19.8L19.4 15.8M12 6.6V3M10.7 4.3h2.6"/><g fill="currentColor" stroke="none"><circle cx="4" cy="7.8" r="1.05"/><circle cx="8" cy="7" r="1.05"/><circle cx="16" cy="7" r="1.05"/><circle cx="20" cy="7.8" r="1.05"/><path d="m12 15.9 1 1.1-1 1.1-1-1.1z"/><circle cx="8" cy="17.3" r=".75"/><circle cx="16" cy="17.3" r=".75"/></g></g></svg>',
  /** Feast of the Cross. The budded Coptic cross, shining as when it was found. */
  cross: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.6v12.8M5.6 12h12.8M9.2 9.2 7.8 7.8M14.8 9.2l1.4-1.4M9.2 14.8l-1.4 1.4M14.8 14.8l1.4 1.4"/><g fill="currentColor" stroke="none"><circle cx="12" cy="3.4" r="1.1"/><circle cx="10.4" cy="4.9" r="1.1"/><circle cx="13.6" cy="4.9" r="1.1"/><circle cx="12" cy="20.6" r="1.1"/><circle cx="10.4" cy="19.1" r="1.1"/><circle cx="13.6" cy="19.1" r="1.1"/><circle cx="3.4" cy="12" r="1.1"/><circle cx="4.9" cy="10.4" r="1.1"/><circle cx="4.9" cy="13.6" r="1.1"/><circle cx="20.6" cy="12" r="1.1"/><circle cx="19.1" cy="10.4" r="1.1"/><circle cx="19.1" cy="13.6" r="1.1"/></g></svg>',
  /** Nativity Fast & Kiahk. The bush that burned and was not consumed, like the Theotokos who carried the divine fire. */
  kiahk: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21C7.6 21 4.6 18 4.6 14c0-2.6 1-4.6 2-6.4.8 1.4 1.6 2.2 2.6 2.6 0-3 1.2-5.6 2.8-8 1.6 2.4 2.8 5 2.8 8 1-.4 1.8-1.2 2.6-2.6 1 1.8 2 3.8 2 6.4 0 4-3 7-7.4 7z"/><path d="M12 19.2v-3.6M12 17.4c-1.2-.4-2.1-1.3-2.5-2.6M12 17.4c1.2-.4 2.1-1.3 2.5-2.6M12 15.8v-2.6"/><path d="M9.5 14.8Q10.16 13.15 8.4 12.89Q7.74 14.55 9.5 14.8ZM9.9 16.4Q9.34 14.8 8.06 15.91Q8.62 17.51 9.9 16.4ZM14.5 14.8Q16.26 14.55 15.6 12.89Q13.84 13.15 14.5 14.8ZM14.1 16.4Q15.38 17.51 15.94 15.91Q14.66 14.8 14.1 16.4ZM12 13.2Q13.4 12.05 12 10.9Q10.6 12.05 12 13.2ZM12 14.4Q12.21 12.75 10.62 13.24Q10.41 14.89 12 14.4ZM12 14.4Q13.59 14.89 13.38 13.24Q11.79 12.75 12 14.4Z" fill="currentColor" stroke="none"/></svg>',
  /** Feast of the Nativity. The star of Bethlehem. */
  nativity: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.2 8.3 6.8 1.2-6.8 1.2L12 22l-1.2-9.3L4 11.5l6.8-1.2z"/><path d="M8.4 7.9 7.2 6.7M15.6 7.9l1.2-1.2M8.4 15.1l-1.2 1.2M15.6 15.1l1.2 1.2"/></svg>',
  /** Feast of Theophany. The Spirit descending as a dove over the Jordan. */
  theophany: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="16.4" r="1.6"/><path d="M12 14.8c-1.3-1.8-1.4-4.6 0-7.2 1.4 2.6 1.3 5.4 0 7.2z"/><path d="M12 7.6 10.4 4.2h3.2z"/><path d="M11.2 10.4C8.3 9.2 5.6 7.3 3.4 4.4c.3 4 3.2 7.6 7.8 8.4M12.8 10.4c2.9-1.2 5.6-3.1 7.8-6-.3 4-3.2 7.6-7.8 8.4"/><path d="M12 19.6v2.2M9.3 19.1l-1 1.7M14.7 19.1l1 1.7"/></svg>',
  /** Jonah's Fast. The great fish and the sea Jonah was thrown into. */
  jonah: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 14C3.5 10.8 6 9 9.5 9c3.3 0 5.5 2 7.9 4.4l3.2-3c0 1.6-.4 2.6-1 3.2.8.4 1.4 1 1.9 2l-4.1-.6c-2 2.4-4.8 3.6-7.8 3.6C6 18.6 3.5 16.8 3.5 14z"/><circle cx="7.2" cy="12.4" r=".7" fill="currentColor" stroke="none"/><path d="M8 8.4V6.2M8 6.2c-.8-1.2-2-1.6-3-1.2M8 6.2c.8-1.2 2-1.6 3-1.2"/><path d="M2.5 21.2c1.6-1.2 3.1-1.2 4.7 0s3.1 1.2 4.7 0 3.1-1.2 4.7 0 3.1 1.2 4.7 0"/></svg>',
  /** Great Lent. The mountain of the forty days, with the cross at its peak. */
  lent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 20 9 9.5l3.5 5 3-4 6 9.5z"/><path d="M9 9.5V3.8M7.2 5.6h3.6"/></svg>',
  /** Palm Sunday. A palm frond, as the crowds carried before Christ. */
  palm: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.56 20.52Q4.17 2.79 21.36 6.56"/><path d="M4.23 13.25Q6.57 13.88 8.97 13.37Q6.63 11.52 4.23 13.25ZM4.23 13.25Q4.2 10.58 2.25 10.51Q2.28 11.96 4.23 13.25ZM4.98 11.73Q7.94 12.55 11.22 12.57Q8.26 10.21 4.98 11.73ZM4.98 11.73Q5.13 8.57 3.15 8Q3 9.61 4.98 11.73ZM5.85 10.39Q9.14 11.58 13.01 12.22Q9.73 9.29 5.85 10.39ZM5.85 10.39Q6.42 7.03 4.7 6Q4.13 7.63 5.85 10.39ZM6.86 9.22Q9.86 10.84 13.72 11.9Q10.72 8.63 6.86 9.22ZM6.86 9.22Q7.96 6.22 6.7 4.96Q5.6 6.31 6.86 9.22ZM7.99 8.22Q10.63 10.22 14.4 11.69Q11.76 8.14 7.99 8.22ZM7.99 8.22Q9.54 5.68 8.77 4.25Q7.22 5.23 7.99 8.22ZM9.25 7.41Q11.48 9.7 15.08 11.52Q12.85 7.77 9.25 7.41ZM9.25 7.41Q11.13 5.37 10.84 3.84Q8.97 4.41 9.25 7.41ZM10.64 6.77Q12.43 9.25 15.78 11.34Q14 7.49 10.64 6.77ZM10.64 6.77Q12.71 5.24 12.87 3.7Q10.8 3.85 10.64 6.77ZM12.15 6.3Q13.49 8.88 16.57 11.12Q15.23 7.28 12.15 6.3ZM12.15 6.3Q14.3 5.27 14.82 3.78Q12.67 3.55 12.15 6.3ZM13.79 6.01Q14.7 8.57 17.48 10.84Q16.58 7.14 13.79 6.01ZM13.79 6.01Q15.9 5.43 16.68 4.03Q14.57 3.48 13.79 6.01ZM15.56 5.9Q16.06 8.34 18.54 10.51Q18.04 7.05 15.56 5.9ZM15.56 5.9Q17.55 5.71 18.46 4.42Q16.47 3.6 15.56 5.9ZM17.46 5.96Q17.58 8.18 19.76 10.12Q19.65 7.03 17.46 5.96ZM17.46 5.96Q19.23 6.12 20.16 4.94Q18.39 3.91 17.46 5.96ZM19.49 6.2Q19.24 8.07 21.12 9.6Q21.37 7.05 19.49 6.2ZM19.49 6.2Q20.94 6.68 21.75 5.57Q20.3 4.41 19.49 6.2Z" fill="currentColor" stroke="none"/></svg>',
  /** Holy Week. The crown of thorns. */
  holyweek: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><g stroke-width="1.2"><path d="M20.36 12.2C20.45 12.39 20.53 12.63 20.55 12.86C20.57 13.09 20.54 13.35 20.47 13.59C20.39 13.82 20.27 14.06 20.1 14.25C19.94 14.45 19.72 14.62 19.49 14.75C19.26 14.88 18.98 14.98 18.7 15.04C18.41 15.09 18.1 15.11 17.79 15.11C17.48 15.1 17.15 15.06 16.83 15.02C16.5 14.97 16.17 14.9 15.85 14.84C15.52 14.78 15.2 14.7 14.88 14.66C14.56 14.61 14.24 14.57 13.92 14.55C13.6 14.54 13.29 14.55 12.97 14.58C12.65 14.62 12.33 14.68 12 14.76C11.67 14.84 11.34 14.95 11.01 15.06C10.67 15.17 10.32 15.3 9.97 15.42C9.63 15.53 9.27 15.66 8.91 15.75C8.56 15.84 8.2 15.93 7.85 15.97C7.5 16.01 7.15 16.03 6.82 16.01C6.49 15.98 6.17 15.91 5.88 15.81C5.6 15.7 5.33 15.55 5.1 15.38C4.87 15.2 4.67 14.98 4.51 14.75C4.35 14.53 4.24 14.26 4.16 14.02C4.08 13.77 4.06 13.51 4.06 13.28C4.05 13.06 4.1 12.84 4.15 12.66C4.2 12.48 4.28 12.33 4.36 12.2C4.44 12.07 4.54 11.98 4.63 11.88C4.72 11.78 4.81 11.7 4.9 11.6C4.98 11.5 5.07 11.4 5.16 11.28C5.26 11.16 5.36 11.02 5.48 10.86C5.61 10.71 5.74 10.53 5.9 10.35C6.05 10.17 6.23 9.97 6.43 9.78C6.63 9.58 6.86 9.38 7.1 9.19C7.35 9 7.62 8.81 7.91 8.65C8.19 8.48 8.51 8.33 8.83 8.21C9.15 8.09 9.49 7.98 9.84 7.91C10.19 7.84 10.55 7.8 10.91 7.79C11.27 7.78 11.64 7.8 12 7.84C12.36 7.89 12.72 7.97 13.07 8.06C13.42 8.16 13.77 8.28 14.1 8.42C14.43 8.55 14.74 8.71 15.05 8.86C15.35 9.01 15.64 9.18 15.91 9.34C16.18 9.5 16.43 9.67 16.67 9.82C16.92 9.96 17.14 10.11 17.35 10.24C17.57 10.37 17.77 10.48 17.96 10.59C18.16 10.69 18.34 10.78 18.52 10.86C18.7 10.95 18.87 11.02 19.04 11.1C19.21 11.18 19.38 11.25 19.54 11.35C19.71 11.45 19.87 11.55 20.01 11.7C20.14 11.84 20.27 12.01 20.36 12.2Z"/><path d="M19.33 12.2C19.31 12.31 19.27 12.38 19.26 12.49C19.26 12.61 19.28 12.73 19.28 12.9C19.29 13.07 19.31 13.28 19.28 13.52C19.26 13.75 19.22 14.04 19.13 14.3C19.04 14.56 18.91 14.86 18.73 15.09C18.56 15.33 18.34 15.57 18.08 15.73C17.83 15.9 17.52 16.02 17.21 16.08C16.89 16.14 16.53 16.13 16.18 16.09C15.83 16.04 15.46 15.93 15.1 15.81C14.74 15.69 14.37 15.52 14.02 15.38C13.67 15.24 13.33 15.08 12.99 14.97C12.65 14.87 12.33 14.78 12 14.75C11.67 14.71 11.35 14.73 11.02 14.78C10.69 14.83 10.36 14.93 10.02 15.04C9.68 15.15 9.33 15.31 8.97 15.43C8.62 15.55 8.25 15.69 7.9 15.77C7.55 15.85 7.19 15.92 6.86 15.91C6.53 15.9 6.2 15.85 5.92 15.73C5.64 15.62 5.38 15.44 5.18 15.24C4.98 15.03 4.82 14.76 4.7 14.51C4.59 14.26 4.53 13.96 4.5 13.71C4.47 13.47 4.49 13.22 4.51 13.02C4.53 12.82 4.59 12.66 4.62 12.53C4.64 12.39 4.65 12.31 4.67 12.2C4.68 12.09 4.68 12.01 4.68 11.89C4.67 11.77 4.64 11.63 4.65 11.46C4.65 11.29 4.65 11.08 4.69 10.86C4.74 10.65 4.81 10.39 4.93 10.17C5.04 9.94 5.2 9.7 5.39 9.5C5.58 9.31 5.81 9.12 6.06 8.98C6.32 8.84 6.61 8.73 6.92 8.67C7.22 8.6 7.56 8.58 7.89 8.58C8.22 8.58 8.57 8.62 8.92 8.67C9.26 8.72 9.61 8.79 9.96 8.86C10.3 8.92 10.65 9 10.99 9.05C11.33 9.1 11.66 9.15 12 9.17C12.34 9.18 12.67 9.18 13.01 9.16C13.34 9.15 13.68 9.1 14.02 9.05C14.36 9.01 14.7 8.94 15.04 8.89C15.38 8.85 15.73 8.79 16.06 8.77C16.39 8.75 16.73 8.74 17.04 8.78C17.36 8.81 17.66 8.88 17.94 8.98C18.21 9.08 18.46 9.23 18.67 9.41C18.88 9.58 19.06 9.8 19.2 10.01C19.33 10.23 19.42 10.48 19.48 10.71C19.53 10.93 19.53 11.17 19.53 11.36C19.52 11.55 19.46 11.72 19.43 11.86C19.4 12 19.36 12.09 19.33 12.2Z"/><path d="M18.56 13.26C18.49 13.33 18.27 13.47 18.13 13.67C17.99 13.86 17.88 14.13 17.73 14.42C17.57 14.7 17.41 15.07 17.19 15.37C16.97 15.66 16.72 16 16.42 16.21C16.12 16.41 15.77 16.58 15.42 16.62C15.06 16.67 14.65 16.61 14.27 16.49C13.88 16.38 13.48 16.14 13.1 15.93C12.72 15.72 12.35 15.44 12 15.25C11.65 15.06 11.31 14.88 10.97 14.8C10.63 14.72 10.3 14.73 9.96 14.78C9.61 14.84 9.25 15 8.89 15.13C8.52 15.27 8.13 15.48 7.75 15.59C7.38 15.7 6.98 15.81 6.64 15.81C6.3 15.8 5.96 15.72 5.7 15.56C5.44 15.41 5.22 15.14 5.06 14.88C4.91 14.61 4.83 14.13 4.78 13.98"/><path d="M4.84 11.37C4.86 11.32 4.89 11.18 4.92 11.07C4.95 10.95 4.98 10.82 5.02 10.69C5.07 10.55 5.11 10.41 5.18 10.26C5.24 10.12 5.31 9.97 5.4 9.83C5.49 9.69 5.6 9.55 5.71 9.42C5.83 9.3 5.96 9.18 6.11 9.08C6.25 8.98 6.42 8.89 6.58 8.83C6.75 8.76 6.93 8.71 7.12 8.68C7.31 8.65 7.51 8.64 7.71 8.64C7.9 8.64 8.11 8.66 8.32 8.68C8.52 8.71 8.73 8.75 8.94 8.79C9.15 8.82 9.36 8.87 9.56 8.91C9.77 8.95 9.98 9 10.18 9.03C10.38 9.06 10.59 9.09 10.79 9.1C10.99 9.11 11.19 9.12 11.39 9.11C11.6 9.1 11.9 9.06 12 9.05"/><path d="M14.47 8.68C14.55 8.73 14.8 8.87 14.95 8.97C15.11 9.06 15.26 9.16 15.41 9.24C15.56 9.33 15.7 9.41 15.85 9.49C15.99 9.56 16.13 9.63 16.27 9.69C16.41 9.74 16.55 9.79 16.69 9.83C16.83 9.87 16.97 9.9 17.11 9.92C17.25 9.95 17.4 9.96 17.54 9.97C17.68 9.99 17.83 9.99 17.97 10C18.12 10.01 18.27 10.01 18.41 10.02C18.55 10.03 18.7 10.04 18.84 10.06C18.98 10.09 19.12 10.11 19.25 10.15C19.38 10.19 19.51 10.24 19.62 10.3C19.73 10.36 19.84 10.43 19.93 10.52C20.02 10.6 20.1 10.7 20.15 10.8C20.21 10.9 20.26 11.02 20.28 11.13C20.31 11.24 20.3 11.42 20.3 11.48"/></g><path d="M6.74 9.4L4.09 7.69L5.99 10.2ZM10.81 8.86L10.41 5.44L9.71 8.81ZM16.17 9.12L15.55 5.94L15.07 9.15ZM18.74 10.71L20.84 8.78L18.17 9.77ZM4.59 11.5L2.35 10.06L3.81 12.28ZM20.21 12.43L21.74 10.26L19.47 11.63ZM18.43 14.64L21.11 15.62L19 13.7ZM15.39 15.49L15.92 18.79L16.49 15.49ZM10.21 16L11.14 19.42L11.31 15.88ZM6.48 14.71L4.62 17.37L7.26 15.48ZM4 12.92L2.87 15.44L4.9 13.57ZM13.76 15.85L13.75 12.51L12.67 15.67ZM9.27 15.44L8.45 12.51L8.17 15.54ZM13.4 8.17L12.9 10.68L14.4 8.61ZM7.31 9.06L8.89 10.95L8.29 8.56Z" fill="currentColor" stroke="currentColor" stroke-width=".4"/></svg>',
  /** Holy Fifty Days. The empty tomb, its stone rolled away. */
  holy50: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20.5h20"/><path d="M2.6 20.5c0-5.3 1.4-9.8 4.9-11.8 2.8-1.6 6.1-1.3 8.5.5 1.4 1.1 2.4 2.6 2.8 4.2"/><path d="M6.2 20.5v-4.6a2.7 2.7 0 0 1 5.4 0v4.6"/><path d="M7.6 18.9h2.6"/><circle cx="18" cy="16.8" r="3.7" fill="currentColor" stroke="none"/></svg>',
  /** Apostles' Fast. The fish: the apostles were made fishers of men. */
  apostles: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 12C18 7 12 5.6 7.5 9 5.6 10.4 4.1 12.4 2.5 15.5M21.5 12C18 17 12 18.4 7.5 15 5.6 13.6 4.1 11.6 2.5 8.5"/><path d="M14.2 8.4c1.1 2 1.1 5.2 0 7.2"/><circle cx="17.2" cy="10.9" r=".8" fill="currentColor" stroke="none"/></svg>',
  /** St. Mary's Fast. The lily, for the purity of the Virgin. */
  marian: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-9.4"/><path d="M12 19c-2.4-.3-4-1.8-4.6-3.9 2.3 0 3.9 1.4 4.6 3.9zM12 19c2.4-.3 4-1.8 4.6-3.9-2.3 0-3.9 1.4-4.6 3.9z"/><path d="M12 12.6c-1.5-2-1.6-5.5 0-8.6 1.6 3.1 1.5 6.6 0 8.6zM12 12.6C9 12.6 6.5 10.8 5.4 7.6c3 .1 5.4 2 6.6 5zM12 12.6c3 0 5.5-1.8 6.6-5-3 .1-5.4 2-6.6 5z"/></svg>',
};

/**
 * The icon each season on the platform wears, by its slug (learning.seasons).
 * The design draws the Church year's sets; a feast inside one of them wears
 * its set's icon (the Paramoun and the Circumcision the Nativity's star), a
 * few borrow the symbol that tells their story, and a feast it doesn't draw
 * wears the budded cross.
 */
const ICON_BY_SLUG: Record<string, SeasonIconKey> = {
  'annual-psalmody': 'psalmody',
  'raising-of-incense': 'incense',
  liturgy: 'liturgy',
  veneration: 'veneration',
  'joyful-29': 'joyful',
  nayrouz: 'nayrouz',
  'feast-of-the-cross': 'cross',
  'nativity-fast-kiahk': 'kiahk',
  'nativity-paramoun': 'nativity',
  nativity: 'nativity',
  circumcision: 'nativity',
  'theophany-paramoun': 'theophany',
  theophany: 'theophany',
  'wedding-at-cana': 'theophany',
  annunciation: 'marian',
  'jonahs-fast': 'jonah',
  lent: 'lent',
  // Lazarus called out of the tomb.
  'lazarus-saturday': 'holy50',
  'palm-sunday': 'palm',
  'holy-week': 'holyweek',
  resurrection: 'holy50',
  'thomas-sunday': 'holy50',
  ascension: 'holy50',
  // The Spirit descending, as the dove over the Jordan.
  pentecost: 'theophany',
  'apostles-fast-and-feast': 'apostles',
  'st-mary-fast-and-feast': 'marian',
  // The mountain of the Transfiguration.
  transfiguration: 'lent',
};

export function seasonIconFor(slug: string | null | undefined): SeasonIconKey {
  const key = slug?.trim().toLowerCase() ?? '';
  return Object.prototype.hasOwnProperty.call(ICON_BY_SLUG, key) ? ICON_BY_SLUG[key] : 'cross';
}
