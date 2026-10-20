/* Isolated browser QA harness. Never imported by production or copied into images. */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const {createRequire} = require('node:module');
const root=path.resolve(__dirname,'../../..');
const req=createRequire(path.join(root,'package.json'));
if(!process.env.FLOAT_TEST_DATABASE_URL?.includes('/float_test'))throw new Error('Only an isolated float_test database is allowed.');
process.env.DATABASE_URL=process.env.FLOAT_TEST_DATABASE_URL;
process.env.MPAO_ENTITY_ID='1';process.env.APP_NAME='petty-cash';
process.env.FILE_STORAGE='local';process.env.APP_ENV='development';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'float-browser-'));process.env.FILE_STORAGE_PATH=path.join(temp,'receipts');
fs.writeFileSync(path.join(temp,'.env'),`APP_NAME=petty-cash\nAPP_ENV=production\nCLIENT_ID=test\nCLIENT_SECRET=test\nAUTH_ENDPOINT=http://127.0.0.1:4002\nJWT_PUB=${path.join(root,'apps/petty-cash-api/secrets/jwtRS256.key.pub')}\nJWT_LOGGING=production\n`);
process.chdir(temp);
const {Test}=req('@nestjs/testing');const {IdentityGuard}=req('@pension/midgard');
const {BUSINESS_MODULES}=req(path.join(root,'apps/petty-cash-api/dist/src/business.modules.js'));
const {ROLE_PERMISSIONS}=req(path.join(root,'apps/petty-cash-api/dist/src/test/permission-fixtures.js'));
const {IdentityTestModule}=req(path.join(root,'apps/petty-cash-api/dist/src/test/identity-test.module.js'));
const roles={gs:'GS_REQUESTER',manager:'GS_MANAGER',finance:'FINANCE_STAFF',supervisor:'FINANCE_SUPERVISOR'};
const users=Object.fromEntries(Object.entries(roles).map(([key,role])=>[key,{uuid:`test-${key}`,name:{gs:'GS Staff',manager:'GS Manager',finance:'Finance Staff',supervisor:'Finance Supervisor'}[key],email:`${key}@example.test`,username:key,identifier:key,transacting_as:1,transacting_as_organisation:{organisation_uuid:'11111111-1111-4111-8111-111111111111',name:'Maldives Pension Administration Office'},organisations:[],roles:[role],user_roles:[],permissions:ROLE_PERMISSIONS[role].map(p=>`petty-cash.${p}`),user_permissions:[],delegated_sessions:[],claimed_delegations:[]} ]));
async function main(){
 const module=await Test.createTestingModule({imports:[IdentityTestModule,...BUSINESS_MODULES]}).overrideGuard(IdentityGuard).useValue({canActivate(context){const r=context.switchToHttp().getRequest();const user=users[(r.headers.authorization||'').replace('Bearer test-','')];if(!user)return false;r.user=user;return true;}}).compile();
 const app=module.createNestApplication();app.enableCors();
 const express=app.getHttpAdapter().getInstance();
 express.get('/me',(r,s)=>s.json({data:users[(r.headers.authorization||'').replace('Bearer test-','')]||users.gs}));
 express.get('/apps',(_r,s)=>s.json([]));
 await app.listen(4002,'127.0.0.1');
 const proxy=http.createServer((r,s)=>{
  if(r.url.startsWith('/test-login')){const role=new URL(r.url,'http://local').searchParams.get('role')||'gs';if(!users[role]){s.writeHead(400);s.end();return;}s.setHeader('Content-Type','text/html');s.end(`<script>localStorage.setItem('user',${JSON.stringify(JSON.stringify(users[role]))});localStorage.setItem('access_token','test-${role}');location.replace('/');</script>`);return;}
  const upstream=http.request({hostname:'127.0.0.1',port:3002,path:r.url,method:r.method,headers:r.headers},response=>{s.writeHead(response.statusCode,response.headers);response.pipe(s);});upstream.on('error',()=>{s.writeHead(502);s.end('UI preview not running');});r.pipe(upstream);
 });
 proxy.listen(3001,'127.0.0.1',()=>console.log('Float QA: http://127.0.0.1:3001/test-login?role=gs'));
 const stop=async()=>{proxy.close();await app.close();fs.rmSync(temp,{recursive:true,force:true});process.exit();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
main().catch(e=>{console.error(e);process.exit(1);});
