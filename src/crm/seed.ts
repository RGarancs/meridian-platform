// Invented example company "Kalna Studio" selling to invented Baltic firms.
// No real people or companies.
import { CrmData } from './domain';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const day = (d: number) => daysAgo(-d).slice(0, 10);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function seedCrm(): CrmData {
  return {
    companies: [
      { id: 'co_birch', name: 'Birch & Co Furniture', domain: 'birch.example', industry: 'Manufacturing', size: '50-249', country: 'LV', createdAt: daysAgo(60) },
      { id: 'co_amber', name: 'Amber Coast Hotels', domain: 'ambercoast.example', industry: 'Hospitality', size: '50-249', country: 'LT', createdAt: daysAgo(45) },
      { id: 'co_north', name: 'Northlight Logistics', domain: 'northlight.example', industry: 'Logistics', size: '250+', country: 'EE', createdAt: daysAgo(40) },
      { id: 'co_rye', name: 'Rye Field Bakery', domain: 'ryefield.example', industry: 'Food', size: '10-49', country: 'LV', createdAt: daysAgo(30) },
      { id: 'co_vela', name: 'Vela Dental Clinics', domain: 'vela.example', industry: 'Healthcare', size: '10-49', country: 'LV', createdAt: daysAgo(20) },
      { id: 'co_linden', name: 'Linden Law', domain: 'linden.example', industry: 'Professional services', size: '10-49', country: 'LV', createdAt: daysAgo(400), props: { plan: 'Sales + People', renewal: day(40), seats: 18 } },
      { id: 'co_harbour', name: 'Harbour Tech', domain: 'harbour.example', industry: 'Software', size: '50-249', country: 'EE', createdAt: daysAgo(300), props: { plan: 'Sales', renewal: day(12), seats: 35 } },
      { id: 'co_saule', name: 'Saule Solar', domain: 'saule.example', industry: 'Energy', size: '50-249', country: 'LT', createdAt: daysAgo(260), props: { plan: 'People', renewal: day(95), seats: 60 } },
      { id: 'co_forest', name: 'Forest Path Kindergartens', domain: 'forestpath.example', industry: 'Education', size: '50-249', country: 'LV', createdAt: daysAgo(220), props: { plan: 'People', renewal: day(150), seats: 44 } },
      { id: 'co_tallink', name: 'Bay Ferry Supplies', domain: 'bayferry.example', industry: 'Logistics', size: '10-49', country: 'EE', createdAt: daysAgo(200), props: { plan: 'Sales', renewal: day(25), seats: 9 } },
      { id: 'co_daugava', name: 'River Print House', domain: 'riverprint.example', industry: 'Manufacturing', size: '10-49', country: 'LV', createdAt: daysAgo(380), props: { plan: 'Sales + People', renewal: day(5), seats: 22 } },
      { id: 'co_kauno', name: 'Kaunas Craft Brewery', domain: 'kaunascraft.example', industry: 'Food', size: '10-49', country: 'LT', createdAt: daysAgo(15) },
      { id: 'co_pine', name: 'Pine Ridge Accounting', domain: 'pineridge.example', industry: 'Professional services', size: '1-9', country: 'LV', createdAt: daysAgo(120) },
    ],
    contacts: [
      { id: 'ct_1', firstName: 'Ilze', lastName: 'Kalnina', email: 'ilze@birch.example', role: 'CEO', companyId: 'co_birch', source: 'Referral', lawfulBasis: 'legitimate_interest', createdAt: daysAgo(60) },
      { id: 'ct_2', firstName: 'Tomas', lastName: 'Petraitis', email: 'tomas@ambercoast.example', role: 'Marketing director', companyId: 'co_amber', source: 'Conference', lawfulBasis: 'consent', consentDate: day(-45), createdAt: daysAgo(45) },
      { id: 'ct_3', firstName: 'Kadri', lastName: 'Tamm', email: 'kadri@northlight.example', role: 'HR lead', companyId: 'co_north', source: 'Website form', lawfulBasis: 'consent', consentDate: day(-40), createdAt: daysAgo(40) },
      { id: 'ct_4', firstName: 'Martins', lastName: 'Ozols', email: 'martins@ryefield.example', role: 'Owner', companyId: 'co_rye', source: 'Event', lawfulBasis: 'legitimate_interest', createdAt: daysAgo(30) },
      { id: 'ct_5', firstName: 'Laura', lastName: 'Liepa', email: 'laura@vela.example', role: 'Operations manager', companyId: 'co_vela', source: 'LinkedIn', lawfulBasis: 'legitimate_interest', createdAt: daysAgo(20) },
      { id: 'ct_6', firstName: 'Andris', lastName: 'Berzins', role: 'CFO', companyId: 'co_birch', source: 'Referral', lawfulBasis: 'contract', createdAt: daysAgo(50) },
      { id: 'ct_7', firstName: 'Liga', lastName: 'Sprogis', email: 'liga@linden.example', role: 'Office manager', companyId: 'co_linden', source: 'Referral', lawfulBasis: 'contract', createdAt: daysAgo(400) },
      { id: 'ct_8', firstName: 'Mart', lastName: 'Kask', email: 'mart@harbour.example', role: 'COO', companyId: 'co_harbour', source: 'Conference', lawfulBasis: 'contract', createdAt: daysAgo(300) },
      { id: 'ct_9', firstName: 'Ruta', lastName: 'Jonaitis', email: 'ruta@saule.example', role: 'HR director', companyId: 'co_saule', source: 'Website form', lawfulBasis: 'consent', consentDate: day(-720), createdAt: daysAgo(260) },
      { id: 'ct_10', firstName: 'Dace', lastName: 'Lapina', email: 'dace@forestpath.example', role: 'Head of people', companyId: 'co_forest', source: 'Event', lawfulBasis: 'contract', createdAt: daysAgo(220) },
      { id: 'ct_11', firstName: 'Kristjan', lastName: 'Mets', email: 'kristjan@bayferry.example', role: 'Owner', companyId: 'co_tallink', source: 'LinkedIn', lawfulBasis: 'contract', createdAt: daysAgo(200) },
      { id: 'ct_12', firstName: 'Janis', lastName: 'Rozitis', email: 'janis@riverprint.example', role: 'Managing director', companyId: 'co_daugava', source: 'Referral', lawfulBasis: 'contract', createdAt: daysAgo(380) },
      { id: 'ct_13', firstName: 'Paulius', lastName: 'Vaitkus', email: 'paulius@kaunascraft.example', role: 'Co-founder', companyId: 'co_kauno', source: 'Website form', lawfulBasis: 'consent', consentDate: day(-15), createdAt: daysAgo(15) },
      { id: 'ct_14', firstName: 'Zane', lastName: 'Ozolina', email: 'zane@pineridge.example', role: 'Partner', companyId: 'co_pine', source: 'Event', lawfulBasis: 'legitimate_interest', unsubscribed: true, createdAt: daysAgo(120) },
    ],
    deals: [
      { id: 'dl_1', title: 'Birch: Sales + Marketing modules', companyId: 'co_birch', contactId: 'ct_1', stage: 'negotiation', value: 14400, currency: 'EUR', expectedClose: day(10), nextStep: 'Send revised offer', nextStepDue: day(-1), createdAt: daysAgo(55) },
      { id: 'dl_2', title: 'Amber Coast: brand relaunch', companyId: 'co_amber', contactId: 'ct_2', stage: 'proposal', value: 7500, currency: 'EUR', expectedClose: day(21), nextStep: 'Workshop with GM', nextStepDue: day(0), createdAt: daysAgo(40) },
      { id: 'dl_3', title: 'Northlight: People module pilot', companyId: 'co_north', contactId: 'ct_3', stage: 'qualified', value: 9600, currency: 'EUR', expectedClose: day(35), createdAt: daysAgo(35) },
      { id: 'dl_4', title: 'Rye Field: website and tracking', companyId: 'co_rye', contactId: 'ct_4', stage: 'lead', value: 3500, currency: 'EUR', expectedClose: day(60), nextStep: 'Intro call', createdAt: daysAgo(28) },
      { id: 'dl_5', title: 'Vela: AI training for staff', companyId: 'co_vela', contactId: 'ct_5', stage: 'lead', value: 4200, currency: 'EUR', expectedClose: day(45), nextStep: 'Send course outline', nextStepDue: day(3), createdAt: daysAgo(18) },
      { id: 'dl_6', title: 'Birch: strategy workbook', companyId: 'co_birch', contactId: 'ct_6', stage: 'won', value: 3500, currency: 'EUR', createdAt: daysAgo(50), closedAt: daysAgo(20) },
      { id: 'dl_8', title: 'Linden: Sales + People annual', companyId: 'co_linden', contactId: 'ct_7', stage: 'won', value: 9800, currency: 'EUR', createdAt: daysAgo(400), closedAt: daysAgo(365) },
      { id: 'dl_9', title: 'Harbour: Sales annual', companyId: 'co_harbour', contactId: 'ct_8', stage: 'won', value: 12600, currency: 'EUR', createdAt: daysAgo(300), closedAt: daysAgo(280) },
      { id: 'dl_10', title: 'Harbour: support add-on', companyId: 'co_harbour', contactId: 'ct_8', stage: 'proposal', value: 4800, currency: 'EUR', expectedClose: day(20), nextStep: 'Price call with Mart', nextStepDue: day(4), createdAt: daysAgo(10) },
      { id: 'dl_11', title: 'Saule: People annual', companyId: 'co_saule', contactId: 'ct_9', stage: 'won', value: 15000, currency: 'EUR', createdAt: daysAgo(260), closedAt: daysAgo(240) },
      { id: 'dl_12', title: 'Forest Path: People annual', companyId: 'co_forest', contactId: 'ct_10', stage: 'won', value: 11000, currency: 'EUR', createdAt: daysAgo(220), closedAt: daysAgo(200) },
      { id: 'dl_13', title: 'Bay Ferry: Sales starter', companyId: 'co_tallink', contactId: 'ct_11', stage: 'won', value: 2900, currency: 'EUR', createdAt: daysAgo(200), closedAt: daysAgo(190) },
      { id: 'dl_14', title: 'River Print: renewal', companyId: 'co_daugava', contactId: 'ct_12', stage: 'won', value: 8400, currency: 'EUR', createdAt: daysAgo(380), closedAt: daysAgo(70) },
      { id: 'dl_15', title: 'River Print: Marketing module', companyId: 'co_daugava', contactId: 'ct_12', stage: 'lost', value: 6000, currency: 'EUR', lostReason: 'Price', createdAt: daysAgo(80), closedAt: daysAgo(40) },
      { id: 'dl_16', title: 'Kaunas Craft: Sales starter', companyId: 'co_kauno', contactId: 'ct_13', stage: 'qualified', value: 3200, currency: 'EUR', expectedClose: day(30), nextStep: 'Demo', nextStepDue: day(6), createdAt: daysAgo(12) },
      { id: 'dl_7', title: 'Amber Coast: film package', companyId: 'co_amber', stage: 'lost', value: 11000, currency: 'EUR', lostReason: 'Chose in-house team', createdAt: daysAgo(44), closedAt: daysAgo(15) },
    ],
    activities: [
      { id: 'ac_1', kind: 'meeting', text: 'Demo of Sales and Marketing. Wants both, asks for a 12-month price.', at: daysAgo(6), by: 'Rihards', dealId: 'dl_1', contactId: 'ct_1', companyId: 'co_birch' },
      { id: 'ac_2', kind: 'email', text: 'Sent first offer: 2 modules, 12 months.', at: daysAgo(4), by: 'Rihards', dealId: 'dl_1', contactId: 'ct_1', companyId: 'co_birch' },
      { id: 'ac_3', kind: 'call', text: 'Relaunch timing: before summer season.', at: daysAgo(9), by: 'Rihards', dealId: 'dl_2', contactId: 'ct_2', companyId: 'co_amber' },
      { id: 'ac_4', kind: 'note', text: 'Leave and onboarding in spreadsheets today; 300 staff across 3 countries.', at: daysAgo(30), by: 'Rihards', dealId: 'dl_3', contactId: 'ct_3', companyId: 'co_north' },
      { id: 'ac_5', kind: 'note', text: 'Owner retiring in 3 years, wants the site to sell the business story.', at: daysAgo(27), by: 'Rihards', contactId: 'ct_4', companyId: 'co_rye' },
      { id: 'ac_6', kind: 'stage_change', text: 'Proposal → Won', at: daysAgo(20), by: 'Rihards', dealId: 'dl_6', companyId: 'co_birch' },
      { id: 'ac_7', kind: 'call', text: 'Quarterly check-in. Happy, adding 4 seats in January.', at: daysAgo(5), by: 'Rihards', contactId: 'ct_7', companyId: 'co_linden' },
      { id: 'ac_8', kind: 'meeting', text: 'Showed the support add-on. Wants it before the renewal.', at: daysAgo(3), by: 'Rihards', dealId: 'dl_10', contactId: 'ct_8', companyId: 'co_harbour' },
      { id: 'ac_9', kind: 'email', text: 'Sent the year-two onboarding plan.', at: daysAgo(48), by: 'Rihards', contactId: 'ct_9', companyId: 'co_saule' },
      { id: 'ac_10', kind: 'note', text: 'Uses leave and reviews daily; asked about Estonian holidays.', at: daysAgo(9), by: 'Rihards', contactId: 'ct_10', companyId: 'co_forest' },
      { id: 'ac_11', kind: 'email', text: 'Renewal reminder sent.', at: daysAgo(75), by: 'Rihards', contactId: 'ct_11', companyId: 'co_tallink' },
      { id: 'ac_12', kind: 'call', text: 'Marketing module too expensive this year. Renewal unclear.', at: daysAgo(40), by: 'Rihards', dealId: 'dl_15', contactId: 'ct_12', companyId: 'co_daugava' },
    ],
    tasks: [
      { id: 'tk_1', title: 'Send revised 12-month offer to Ilze', due: day(-1), done: false, owner: 'You', dealId: 'dl_1', contactId: 'ct_1', companyId: 'co_birch' },
      { id: 'tk_2', title: 'Book relaunch workshop with the GM', due: day(0), done: false, owner: 'You', dealId: 'dl_2', contactId: 'ct_2', companyId: 'co_amber' },
      { id: 'tk_3', title: 'Ask Kadri for the leave spreadsheet', due: day(2), done: false, owner: 'You', dealId: 'dl_3', contactId: 'ct_3', companyId: 'co_north' },
      { id: 'tk_4', title: 'Draft course outline for Vela', due: day(3), done: false, owner: 'You', dealId: 'dl_5', contactId: 'ct_5', companyId: 'co_vela' },
      { id: 'tk_5', title: 'Send case study to Andris', due: day(-6), done: true, owner: 'You', contactId: 'ct_6', companyId: 'co_birch' },
    ],
    properties: [
      { id: 'plan', entity: 'company', label: 'Plan', type: 'select', options: ['Sales', 'People', 'Sales + People', 'All modules'] },
      { id: 'renewal', entity: 'company', label: 'Renewal date', type: 'date' },
      { id: 'seats', entity: 'company', label: 'Seats', type: 'number' },
      { id: 'champion', entity: 'contact', label: 'Champion', type: 'yes_no' },
    ],
    tickets: [
      { id: 'tq_1', subject: 'Invoice shows the wrong VAT number', contactId: 'ct_12', companyId: 'co_daugava', channel: 'email', status: 'open', priority: 'normal', topic: 'Billing', createdAt: hoursAgo(30),
        messages: [{ at: hoursAgo(30), from: 'customer', text: 'Hello, the November invoice shows our old VAT number again. This is the second time. Please send a corrected invoice, our accountant needs it this week.' }] },
      { id: 'tq_2', subject: 'Cannot log in after password reset', contactId: 'ct_10', companyId: 'co_forest', channel: 'chat', status: 'open', priority: 'high', topic: 'Access', createdAt: hoursAgo(2),
        messages: [{ at: hoursAgo(2), from: 'customer', text: 'Urgent: after the password reset I cannot log in, and three managers need to approve leave today.' }] },
      { id: 'tq_3', subject: 'How do I add Estonian holidays?', contactId: 'ct_8', companyId: 'co_harbour', channel: 'email', status: 'waiting', priority: 'normal', topic: 'How to', createdAt: hoursAgo(50), firstReplyAt: hoursAgo(46),
        messages: [{ at: hoursAgo(50), from: 'customer', text: 'How can I add Estonian public holidays to the leave calendar?' }, { at: hoursAgo(46), from: 'us', by: 'Rihards', text: 'Hi Mart, Settings › Time off › Holidays has an Estonia preset. Shall I switch it on for you?' }] },
      { id: 'tq_4', subject: 'Export of reviews would be great', contactId: 'ct_9', companyId: 'co_saule', channel: 'email', status: 'solved', priority: 'low', topic: 'Feature request', createdAt: hoursAgo(200), firstReplyAt: hoursAgo(180), solvedAt: hoursAgo(170),
        messages: [{ at: hoursAgo(200), from: 'customer', text: 'It would be great to export all reviews to Excel for our board.' }, { at: hoursAgo(180), from: 'us', by: 'Rihards', text: 'Thanks Ruta, added to the plan for Q1.' }] },
      { id: 'tq_5', subject: 'Deal board shows a blank column', contactId: 'ct_7', companyId: 'co_linden', channel: 'email', status: 'solved', priority: 'normal', topic: 'Bug', createdAt: hoursAgo(120), firstReplyAt: hoursAgo(118), solvedAt: hoursAgo(100),
        messages: [{ at: hoursAgo(120), from: 'customer', text: 'The deal board shows an empty column on my laptop.' }, { at: hoursAgo(118), from: 'us', by: 'Rihards', text: 'Thanks Liga, fixed in today’s update.' }] },
    ],
    campaigns: [
      { id: 'cp_1', name: 'October customer update', segment: { customersOnly: true }, subject: 'What changed in October', body: 'Hi {first_name},\n\nThree things are new this month...\n\nDon\'t want these emails? Reply "unsubscribe".', status: 'sent', approvedBy: 'Rihards', sentAt: daysAgo(35), recipients: 7, createdAt: daysAgo(36) },
    ],
    dismissed: [],
  };
}
