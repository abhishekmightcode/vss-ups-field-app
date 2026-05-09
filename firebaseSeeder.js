const https = require("https");
const PROJECT_ID = "upscrm-16643";
const COLLECTION = "ups_dealers";
const API_KEY = "AIzaSyDLBkc4fkJP0wU4-DRil1x4zr0nelBZi5E";

const DEALERS = [{"id":"1000036809","code":"1000036809","name":"Ae Battery Point","phone":null},{"id":"1000036990","code":"1000036990","name":"Gayatri Batteries","phone":"+919448043392"},{"id":"1000037111","code":"1000037111","name":"Lalith Enterprises","phone":"+919019257576"},{"id":"1000037174","code":"1000037174","name":"Mohit Power System","phone":"+919449354228"},{"id":"1000037434","code":"1000037434","name":"Shree Solar Products","phone":null},{"id":"1000037509","code":"1000037509","name":"Sri Lakshmi Auto Electrical","phone":"+919448278651"},{"id":"1000037576","code":"1000037576","name":"Thirumala Batteries","phone":"+919886002223"},{"id":"1000046255","code":"1000046255","name":"Mahendra Industries","phone":null},{"id":"1000047208","code":"1000047208","name":"power instrument","phone":"+919845394418"},{"id":"1000047223","code":"1000047223","name":"s.m.auto batteries","phone":"+919900159324"},{"id":"1000049566","code":"1000049566","name":"thirumala battery house","phone":"+919945037722"},{"id":"1000050253","code":"1000050253","name":"sapthagiri batteries","phone":"+919972535556"},{"id":"1000061298","code":"1000061298","name":"Monisha Info Solutions","phone":null},{"id":"1000061715","code":"1000061715","name":"Exclent Power Technologies","phone":null},{"id":"1000062065","code":"1000062065","name":"Thirumala Batteries","phone":null},{"id":"1000063637","code":"1000063637","name":"YASHAS POWER SYSTEMS","phone":null},{"id":"1000063649","code":"1000063649","name":"UNIVERSAL POWER SYSTEMS","phone":"+919008011225"},{"id":"1000063810","code":"1000063810","name":"SUPREME BATTERY POINT","phone":null},{"id":"1000067704","code":"1000067704","name":"Macro Trading Company","phone":null},{"id":"1000070113","code":"1000070113","name":"KAVERI INFOTEK","phone":"+919845653675"},{"id":"1000070351","code":"1000070351","name":"S r Battry service","phone":"+919738289633"},{"id":"1000073321","code":"1000073321","name":"S G SYSTEMS","phone":null},{"id":"1000073322","code":"1000073322","name":"S S ENTERPRISES","phone":"+919739779917"},{"id":"1000074031","code":"1000074031","name":"Av Power Systems and Services","phone":"+919880408640"},{"id":"1000077586","code":"1000077586","name":"Sri Vigneshwara Automobiles","phone":"+919845269960"},{"id":"1000079273","code":"1000079273","name":"sri bhyraveshwara battery point","phone":null},{"id":"1000082657","code":"1000082657","name":"Sri Laxmi BatteryandAuto Electrical Cent","phone":"+919845421341"},{"id":"1000094731","code":"1000094731","name":"S.V. POWER SYSTEMS","phone":null},{"id":"1000102581","code":"1000102581","name":"Auto Power Inc","phone":"+919986988999"},{"id":"1000102593","code":"1000102593","name":"Sri Venkateshwara Power Technologies","phone":null},{"id":"1000102597","code":"1000102597","name":"OM Durga Devi Darshan Battery","phone":"+918970075135"},{"id":"1000103346","code":"1000103346","name":"Varsha Power Technologies","phone":null},{"id":"1000126307","code":"1000126307","name":"SLN sphere solutions","phone":"+919880286269"},{"id":"1000177172","code":"1000177172","name":"SRI RANGANATHA BATTERY POINT","phone":"+919845613618"},{"id":"1000188873","code":"1000188873","name":"shivam power solution","phone":"+919844510641"},{"id":"1000188874","code":"1000188874","name":"Power backup center","phone":"+918722111099"},{"id":"1000188875","code":"1000188875","name":"RAVI ELECTRICAL","phone":"+919845198076"},{"id":"1000188876","code":"1000188876","name":"BHARATH POWER SOLUTIONS","phone":"+919902029306"},{"id":"1000188877","code":"1000188877","name":"SRS ENTERPRISES","phone":"+918867359670"},{"id":"1000188878","code":"1000188878","name":"M/s ROOPA ENTERPRISES","phone":"+917483769659"},{"id":"1000188879","code":"1000188879","name":"ozone power inc","phone":"+919964510444"},{"id":"1000189168","code":"1000189168","name":"Sr power point","phone":"+919019363579"},{"id":"1000189169","code":"1000189169","name":"G-POWER SOLUTIONS","phone":"+919449553650"},{"id":"1000189171","code":"1000189171","name":"CHHAYA POWER SOLUTIONS","phone":"+919448614111"},{"id":"1000189172","code":"1000189172","name":"HIGH LIFE","phone":"+919845466796"},{"id":"1000189173","code":"1000189173","name":"POWERCON K K ENTERPRISES","phone":"+919845381220"},{"id":"1000189174","code":"1000189174","name":"SN POWER SOLUTION","phone":"+917795853959"},{"id":"1000189175","code":"1000189175","name":"SLV BATTERY POINT","phone":"+919742711113"},{"id":"1000193232","code":"1000193232","name":"R V POWER Technologies","phone":"+919845597853"},{"id":"1000193341","code":"1000193341","name":"KARIYAPPA SHIVAKUMAR","phone":"+917829686639"},{"id":"1000193342","code":"1000193342","name":"SRI LAKSHMIBALAJI ENTERPRISES","phone":"+919742792691"},{"id":"1000193343","code":"1000193343","name":"VINAYAKA UPS AND BATTERY","phone":"+916363931257"},{"id":"1000193344","code":"1000193344","name":"PUSHPAK CARRYING CORPORATION","phone":null},{"id":"1000195216","code":"1000195216","name":"saanvy enterprises","phone":"+917795354392"},{"id":"1000197798","code":"1000197798","name":"Manjunatha battery works","phone":"+919845647293"},{"id":"1000199375","code":"1000199375","name":"Thirumala enterprises","phone":"+919986362488"},{"id":"1000200370","code":"1000200370","name":"SLV ENTERPRISES","phone":"+919008000553"},{"id":"1000200436","code":"1000200436","name":"R G POWER SOLUTIONS","phone":"+919986749007"},{"id":"1000200743","code":"1000200743","name":"SM battery and auto electrical","phone":"+917899957727"},{"id":"1000200748","code":"1000200748","name":"Sri Nanjundeshwara enterprises","phone":"+919739880029"},{"id":"1000200900","code":"1000200900","name":"RPM POWER SOLUTIONS","phone":"+919741639741"},{"id":"1000204044","code":"1000204044","name":"S V ENTERPRISES","phone":"+919060405480"},{"id":"1000205179","code":"1000205179","name":"kamplis power solutions","phone":"+919880737217"},{"id":"1000205824","code":"1000205824","name":"VIBRANT POWER TECHNOLOGIES","phone":"+917090708099"},{"id":"1000206348","code":"1000206348","name":"microsys enterprises","phone":"+919901475024"},{"id":"1000206349","code":"1000206349","name":"Sri Devi battery house","phone":"+919036543234"},{"id":"1000208372","code":"1000208372","name":"VIKAS K M","phone":"+919591767417"},{"id":"1000209930","code":"1000209930","name":"OMKAR POWER SOLUTIONS","phone":"+919538933997"},{"id":"1000211535","code":"1000211535","name":"INDITECH POWER CONTROLS","phone":"+919483343761"},{"id":"1000212508","code":"1000212508","name":"Harshita Tiwari","phone":null},{"id":"1000220044","code":"1000220044","name":"Sathya Sai Enterprises","phone":"+918217836848"},{"id":"1000222281","code":"1000222281","name":"Sri Devi Battery House","phone":"+919019232349"},{"id":"1000222780","code":"1000222780","name":"GREENLEAF POWER SOLUTIONS","phone":"+918553941004"},{"id":"1000222997","code":"1000222997","name":"Sri Basaveshwara Batteries","phone":"+919353678727"},{"id":"1000223080","code":"1000223080","name":"GOUTHAM ELECTRONICS","phone":"+919739592490"},{"id":"1000223930","code":"1000223930","name":"SRI SAI ENTERPRISES","phone":"+918123850567"},{"id":"1000224331","code":"1000224331","name":"AADITYA POWER SYSTEM","phone":"+919448059232"},{"id":"1000225149","code":"1000225149","name":"J P ENTERPRISES","phone":"+919900553029"},{"id":"1000225151","code":"1000225151","name":"SRI VENKATESWARA BATTERYS SALES AND SERV","phone":"+919740075491"},{"id":"1000226489","code":"1000226489","name":"SAI POWER SOLUTIONS","phone":"+919611159149"}];

function getIdToken() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ returnSecureToken: true });
    const options = {
      hostname: "www.googleapis.com",
      path: `/identitytoolkit/v3/relyingparty/signupNewUser?key=${API_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.idToken) resolve(json.idToken);
          else reject(new Error("No idToken: " + JSON.stringify(json)));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function commitBatch(idToken, documents) {
  return new Promise((resolve, reject) => {
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
    const payload = JSON.stringify({
      writes: documents.map(doc => ({
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${doc.id}`,
          fields: toFields(doc.data)
        }
      }))
    });
    const options = {
      hostname: "firestore.googleapis.com",
      path: baseUrl,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`${res.statusCode}: ${data.slice(0,200)}`));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) out[k] = { nullValue: null };
    else if (typeof v === "string") out[k] = { stringValue: v };
    else if (typeof v === "number") out[k] = { integerValue: String(v) };
    else if (typeof v === "boolean") out[k] = { booleanValue: v };
  }
  return out;
}

async function main() {
  console.log("Getting token...");
  const idToken = await getIdToken();
  console.log("Seeding ${DEALERS.length} dealers...");
  
  const BATCH = 10;
  let success = 0, fail = 0;
  
  for (let i = 0; i < DEALERS.length; i += BATCH) {
    const batch = DEALERS.slice(i, i + BATCH);
    const docs = batch.map(d => ({
      id: d.id,
      data: { ...d, source: "csv_master", last_synced: new Date().toISOString() }
    }));
    try {
      await commitBatch(idToken, docs);
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.map(d=>d.name).join(", ")}`);
      success += batch.length;
    } catch (e) {
      console.log(`Batch failed: ${e.message}`);
      fail += batch.length;
    }
    if (i + BATCH < DEALERS.length) await new Promise(r => setTimeout(r, 300));
  }
  console.log(`Done! ${success} seeded, ${fail} failed`);
}

main().catch(console.error);
