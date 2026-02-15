export interface LandingFaqItem {
  question: string;
  answer: string;
  links?: readonly {
    label: string;
    href: string;
  }[];
}

export interface ComparisonMatrixRow {
  capability: string;
  bedroomLayoutPlanner: string;
  templateTools: string;
  inspirationArticles: string;
}

export const LANDING_FEATURE_BULLETS: readonly string[] = [
  'Enter exact room dimensions in metric or imperial units.',
  'Drag furniture, doors, and windows to test practical fit.',
  'Export printable PDFs to share layout decisions.',
  'Use optional feng shui checks while iterating.',
];

export const LANDING_CREDIBILITY_BULLETS: readonly string[] = [
  'Free to use with no account required.',
  'Runs in your browser with local autosave support.',
  'Built for practical fit checks, not just inspiration.',
];

export const LANDING_FAQ_ITEMS: readonly LandingFaqItem[] = [
  {
    question: 'Do I need an account to use Bedroom Layout Planner?',
    answer: 'No. You can start planning immediately in the browser without creating an account.',
  },
  {
    question: 'Can I use exact measurements in feet/inches or metric units?',
    answer: 'Yes. The planner supports mm, cm, m, inches, and feet while keeping geometry consistent.',
  },
  {
    question: 'Can I export and share my layout?',
    answer: 'Yes. You can export one room or all rooms as a printable PDF and also export workspace JSON files.',
  },
  {
    question: 'Is this open source?',
    answer: 'Yes. Bedroom Layout Planner is open source.',
    links: [
      {
        label: 'View the code on GitHub',
        href: 'https://github.com/Slaymish/BedroomLayoutDesigner',
      },
    ],
  },
  {
    question: 'I have a bug or feature request!',
    answer: 'Email me and I will review it.',
    links: [
      {
        label: 'hamishapps@gmail.com',
        href: 'mailto:hamishapps@gmail.com',
      },
    ],
  },
  {
    question: 'Is this only for bedrooms?',
    answer: 'The presets focus on bedroom planning, but the tool can also be used for related room layout scenarios.',
  },
];

export const LANDING_COMPARISON_ROWS: readonly ComparisonMatrixRow[] = [
  {
    capability: 'Exact dimension editing for room and objects',
    bedroomLayoutPlanner: 'Yes',
    templateTools: 'Usually limited',
    inspirationArticles: 'No',
  },
  {
    capability: 'Move furniture with immediate layout feedback',
    bedroomLayoutPlanner: 'Yes',
    templateTools: 'Sometimes',
    inspirationArticles: 'No',
  },
  {
    capability: 'Door and window placement tied to walls',
    bedroomLayoutPlanner: 'Yes',
    templateTools: 'Varies by tool',
    inspirationArticles: 'No',
  },
  {
    capability: 'Printable PDF export for decision sharing',
    bedroomLayoutPlanner: 'Yes',
    templateTools: 'Sometimes paid',
    inspirationArticles: 'No',
  },
  {
    capability: 'No-signup access',
    bedroomLayoutPlanner: 'Yes',
    templateTools: 'Varies',
    inspirationArticles: 'Yes',
  },
];
