import test from 'node:test';
import assert from 'node:assert/strict';
import { editorPaste, renderCampaignEmail, sanitizeHtml } from './render.ts';
import { toCSV, toXLSX } from '../../../../src/dashboard/clientExport.js';

test('CSV treats formula-like strings and phone numbers as text, preserving numeric amounts', () => {
  for (const value of ['=1+1','+1+1','-1+1','@SUM(1)','+639171234567',' =1+1','\tvalue','\n=1','\rtext','\uFEFF=1','\u00a0+1']) {
    const csv=toCSV([[value]]).slice(1);
    assert.ok(csv.startsWith("'") || csv.startsWith('"\''), JSON.stringify(value));
  }
  assert.equal(toCSV([[12,-12,0,'ordinary']]), '\uFEFF12,-12,0,ordinary');
  assert.equal(toCSV([['He said "hi", yes']]), '\uFEFF"He said ""hi"", yes"');
  const xlsx=new TextDecoder().decode(toXLSX([['Phone','Amount'],['+1+1',12]]));
  assert.ok(xlsx.includes('t="inlineStr"'));
  assert.ok(!xlsx.includes('<f>'));
});

test('parser removes active markup and encoded protocols without breaking safe formatting', () => {
  const attacks=[
    '<p onclick="alert(1)">Hi<img src=x onerror=alert(1)></p>',
    '<a href="jav&#x61;script:alert(1)">bad</a>',
    '<a href="java&#10;script:alert(1)">bad</a>',
    '<a href="data:text/html,attack">bad</a>',
    '<a href="//untrusted.example">bad</a>',
    '<svg><a xlink:href="javascript:alert(1)">bad</a></svg>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe><object>bad</object>',
    '<p><b>unclosed<script>alert(1)',
  ];
  for(const html of attacks) {
    const clean=sanitizeHtml(html);
    assert.doesNotMatch(clean, /<(script|img|svg|math|style|iframe|object)\b|\son\w+=|(?:javascript|data):/i);
    assert.equal(sanitizeHtml(clean),clean,'sanitized markup remains stable when parsed again');
    assert.equal(editorPaste(html,''),clean,'paste uses the same sanitizer before DOM insertion');
  }
  const safe='<p>Hi <strong>Ana</strong></p><ul><li><em>One</em></li></ul>';
  assert.equal(sanitizeHtml(safe),safe);
  assert.equal(editorPaste('', '<img src=x>\nHello'), '&lt;img src=x&gt;<br>Hello');
  assert.match(sanitizeHtml('<a href="https://example.com/?a=1&amp;b=2">Go</a>'), /href="https:\/\/example.com\/\?a=1&amp;b=2"/);
});

test('server rendering sanitizes stored markup independently of the editor', () => {
  const email=renderCampaignEmail({kind:'service',subject:'Hi',body_html:'<p onclick="x()">{{first_name}}</p><img src=x onerror=x()>',first_name_fallback:'there',from_name:'Air Fair'},'<script>x()</script>');
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.doesNotMatch(email.html, /<script|<img|onclick=/i);
});
