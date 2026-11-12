// Invented example company "Kalna Studio" selling to invented Baltic firms.
// No real people or companies.
import { CrmData } from './domain';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const day = (d: number) => daysAgo(-d).slice(0, 10);

export function seedCrm(): CrmData {
  return {
    companies: [
      { id: 'co_birch', name: 'Birch & Co Furniture', domain: 'birch.example', industry: 'Manufacturing', size: '50-249', country: 'LV', createdAt: daysAgo(60) },
      { id: 'co_amber', name: 'Amber Coast Hotels', domain: 'ambercoast.example', industry: 'Hospitality', size: '50-249', country: 'LT', createdAt: daysAgo(45) },
      { id: 'co_north', name: 'Northlight Logistics', domain: 'northlight.example', industry: 'Logistics', size: '250+', country: 'EE', createdAt: daysAgo(40) },
      { id: 'co_rye', name: 'Rye Field Bakery', domain: 'ryefield.example', industry: 'Food', size: '10-49', country: 'LV', createdAt: daysAgo(30) },
      { id: 'co_vela', name: 'Vela Dental Clinics', domain: 'vela.example', industry: 'Healthcare', size: '10-49', country: 'LV', createdAt: daysAgo(20) },
    ],
    contacts: [
      { id: 'ct_1', firstName: 'Ilze', lastName: 'Kalnina', email: 'ilze@birch.example', role: 'CEO', companyId: 'co_birch', source: 'Referral', lawfulBasis: 'legitimate_interest', createdAt: daysAgo(60) },
      { id: 'ct_2', firstName: 'Tomas', lastName: 'Petraitis', email: 'tomas@ambercoast.example', role: 'Marketing director', companyId: 'co_amber', source: 'Conference', lawfulBasis: 'consent', consentDate: day(-45), createdAt: daysAgo(45) },
      { id: 'ct_3', firstName: 'Kadri', lastName: 'Tamm', email: 'kadri@northlight.example', role: 'HR lead', companyId: 'co_north', source: 'Website form', lawfulBasis: 'consent', consentDate: day(-40), createdAt: daysAgo(40) },
      { id: 'ct_4', firstName: 'Martins', lastName: 'Ozols', email: 'martins@ryefield.example', role: 'Owner', companyId: 'co_rye', source: 'Event', lawfulBasis: 'legitimate_interest', createdAt: daysAgo(30) },
      { id: 'ct_5', firstName: 'Laura', lastName: 'Liepa', email: 'laura@vela.example', role: 'Operations manager', companyId: 'co_vela', source: 'LinkedIn', lawfulBasis: 'legitimate_interest', createdAt: daysAgo(20) },
      { id: 'ct_6', firstName: 'Andris', lastName: 'Berzins', role: 'CFO', companyId: 'co_birch', source: 'Referral', lawfulBasis: 'contract', createdAt: daysAgo(50) },
    ],
    deals: [
      { id: 'dl_1', title: 'Birch: Sales + Marketing modules', companyId: 'co_birch', contactId: 'ct_1', stage: 'negotiation', value: 14400, currency: 'EUR', expectedClose: day(10), nextStep: 'Send revised offer', nextStepDue: day(-1), createdAt: daysAgo(55) },
      { id: 'dl_2', title: 'Amber Coast: brand relaunch', companyId: 'co_amber', contactId: 'ct_2', stage: 'proposal', value: 7500, currency: 'EUR', expectedClose: day(21), nextStep: 'Workshop with GM', nextStepDue: day(0), createdAt: daysAgo(40) },
      { id: 'dl_3', title: 'Northlight: People module pilot', companyId: 'co_north', contactId: 'ct_3', stage: 'qualified', value: 9600, currency: 'EUR', expectedClose: day(35), createdAt: daysAgo(35) },
      { id: 'dl_4', title: 'Rye Field: website and tracking', companyId: 'co_rye', contactId: 'ct_4', stage: 'lead', value: 3500, currency: 'EUR', nextStep: 'Intro call', createdAt: daysAgo(28) },
      { id: 'dl_5', title: 'Vela: AI training for staff', companyId: 'co_vela', contactId: 'ct_5', stage: 'lead', value: 4200, currency: 'EUR', nextStep: 'Send course outline', nextStepDue: day(3), createdAt: daysAgo(18) },
      { id: 'dl_6', title: 'Birch: strategy workbook', companyId: 'co_birch', contactId: 'ct_6', stage: 'won', value: 3500, currency: 'EUR', createdAt: daysAgo(50), closedAt: daysAgo(20) },
      { id: 'dl_7', title: 'Amber Coast: film package', companyId: 'co_amber', stage: 'lost', value: 11000, currency: 'EUR', lostReason: 'Chose in-house team', createdAt: daysAgo(44), closedAt: daysAgo(15) },
    ],
    activities: [
      { id: 'ac_1', kind: 'meeting', text: 'Demo of Sales and Marketing. Wants both, asks for a 12-month price.', at: daysAgo(6), by: 'Rihards', dealId: 'dl_1', contactId: 'ct_1', companyId: 'co_birch' },
      { id: 'ac_2', kind: 'email', text: 'Sent first offer: 2 modules, 12 months.', at: daysAgo(4), by: 'Rihards', dealId: 'dl_1', contactId: 'ct_1', companyId: 'co_birch' },
      { id: 'ac_3', kind: 'call', text: 'Relaunch timing: before summer season.', at: daysAgo(9), by: 'Rihards', dealId: 'dl_2', contactId: 'ct_2', companyId: 'co_amber' },
      { id: 'ac_4', kind: 'note', text: 'Leave and onboarding in spreadsheets today; 300 staff across 3 countries.', at: daysAgo(30), by: 'Rihards', dealId: 'dl_3', contactId: 'ct_3', companyId: 'co_north' },
      { id: 'ac_5', kind: 'note', text: 'Owner retiring in 3 years, wants the site to sell the business story.', at: daysAgo(27), by: 'Rihards', contactId: 'ct_4', companyId: 'co_rye' },
      { id: 'ac_6', kind: 'stage_change', text: 'Proposal → Won', at: daysAgo(20), by: 'Rihards', dealId: 'dl_6', companyId: 'co_birch' },
    ],
  };
}
