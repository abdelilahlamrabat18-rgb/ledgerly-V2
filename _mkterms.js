const fs = require('fs');
const c = [
"import React from 'react';",
"",
"export function TermsPage() {",
"  return (",
'    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">',
'      <div className="max-w-4xl mx-auto space-y-8">',
'        <div>',
'          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">',
'            Ledgerly Terms of Service',
'          </h1>',
'          <p className="mt-2 text-sm text-slate-400">',
'            Effective date: November 2, 2026 | Last updated: November 2, 2026',
'          </p>',
'        </div>',
'      </div>',
'    </div>',
'  );',
'}',
'export default TermsPage;'
];
fs.writeFileSync('src/pages/TermsPage.tsx', c.join('\n'));
console.log('ok');
