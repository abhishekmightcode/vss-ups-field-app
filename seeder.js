#!/usr/bin/env node
// Firebase Firestore Seeder — Node.js
// Usage: node seeder.js

const https = require("https");

// ── Config ─────────────────────────────────────────────────
const PROJECT_ID  = "upscrm-16643";
const COLLECTION  = "ups_dealers";
const API_KEY     = "AIzaSyDLBkc4fkJP0wU4-DRil1x4zr0nelBZi5E";

// ── Firebase Auth: get ID token via anonymous sign-in ──────
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

// ── Firestore: commit batch ────────────────────────────────
function commitBatch(idToken, documents) {
  return new Promise((resolve, reject) => {
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
    const payload = JSON.stringify({
      writes: documents.map(doc => ({
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${doc.id}`,
          fields: toFirestoreFields(doc.data)
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
        else reject(new Error(`Firestore commit failed: ${res.statusCode} — ${data.slice(0, 200)}`));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Convert JS values → Firestore format ──────────────────
function toFirestoreFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out[k] = { nullValue: null };
    } else if (typeof v === "string") {
      out[k] = { stringValue: v };
    } else if (typeof v === "number") {
      out[k] = { integerValue: String(v) };
    } else if (typeof v === "boolean") {
      out[k] = { booleanValue: v };
    } else if (Array.isArray(v)) {
      out[k] = {
        arrayValue: {
          values: v.map(item => {
            if (typeof item === "string") return { stringValue: item };
            if (typeof item === "number") return { integerValue: String(item) };
            if (typeof item === "object" && item !== null) {
              return { mapValue: { fields: toFirestoreFields(item) } };
            }
            return { stringValue: String(item) };
          })
        }
      };
    } else if (typeof v === "object" && !(v instanceof Date)) {
      out[k] = { mapValue: { fields: toFirestoreFields(v) } };
    }
  }
  return out;
}

// ── Dealers ───────────────────────────────────────────────
const DEALERS = [
  {id:"1171062000002741271",name:"CHHAYA POWER SOLUTIONS",phone:"+919448614111",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741263",name:"G-POWER SOLUTIONS",phone:"+919449553650",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741260",name:"HIGH LIFE",phone:"+919845466796",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741256",name:"POWERCON K K ENTERPRISES",phone:"+919845381220",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741252",name:"SN POWER SOLUTION",phone:"+917795853959",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741248",name:"SLV BATTERY POINT",phone:"+919742711113",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741244",name:"R V POWER Technologies",phone:"+919845597853",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741240",name:"KARIYAPPA SHIVAKUMAR",phone:"+917829686639",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741236",name:"SRI LAKSHMIBALAJI ENTERPRISES",phone:"+919742792691",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741232",name:"VINAYAKA UPS AND BATTERY",phone:"+916363931257",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741228",name:"saanvy enterprises",phone:"+917795354392",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741224",name:"Manjunatha battery works",phone:"+919845647293",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741220",name:"Thirumala enterprises",phone:"+919986362488",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741216",name:"SLV ENTERPRISES",phone:"+919008000553",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741212",name:"R G POWER SOLUTIONS",phone:"+919986749007",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741208",name:"SM battery and auto electrical",phone:"+917899957727",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741204",name:"Sri Nanjundeshwara enterprises",phone:"+919739880029",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741200",name:"RPM POWER SOLUTIONS",phone:"+919741639741",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741196",name:"S V ENTERPRISES",phone:"+919060405480",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741192",name:"kamplis power solutions",phone:"+919880737217",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741188",name:"VIBRANT POWER TECHNOLOGIES",phone:"+917090708099",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741184",name:"microsys enterprises",phone:"+919901475024",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741180",name:"Sri Devi battery house",phone:"+919036543234",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741176",name:"VIKAS K M",phone:"+919591767417",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741172",name:"OMKAR POWER SOLUTIONS",phone:"+919538933997",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741168",name:"INDITECH POWER CONTROLS",phone:"+919483343761",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741164",name:"Sathya Sai Enterprises",phone:"+918217836848",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741160",name:"Sri Devi Battery House",phone:"+919019232349",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741156",name:"GREENLEAF POWER SOLUTIONS",phone:"+918553941004",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741152",name:"Sri Basaveshwara Batteries",phone:"+919353678727",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741148",name:"GOUTHAM ELECTRONICS",phone:"+919739592490",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741144",name:"SRI SAI ENTERPRISES",phone:"+918123850567",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741140",name:"AADITYA POWER SYSTEM",phone:"+919448059232",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741136",name:"J P ENTERPRISES",phone:"+919900553029",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002741132",name:"SRI VENKATESWARA BATTERYS SALES AND SERV",phone:"+919740075491",dealer_type:"",dealer_code:"",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727155",name:"Gayatri Batteries",phone:"+919448043392",dealer_type:"",dealer_code:"1000036990",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727235",name:"Lalith Enterprises",phone:"+919019257576",dealer_type:"",dealer_code:"1000037111",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727251",name:"Mohit Power System",phone:"+919449354228",dealer_type:"",dealer_code:"1000037174",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727275",name:"Sri Lakshmi Auto Electrical",phone:"+919448278651",dealer_type:"",dealer_code:"1000037509",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727283",name:"Thirumala Batteries",phone:"+919886002223",dealer_type:"",dealer_code:"1000037576",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727299",name:"power instrument",phone:"+919845394418",dealer_type:"",dealer_code:"1000047208",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727307",name:"s.m.auto batteries",phone:"+919900159324",dealer_type:"",dealer_code:"1000047223",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727315",name:"thirumala battery house",phone:"+919945037722",dealer_type:"",dealer_code:"1000049566",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727323",name:"sapthagiri batteries",phone:"+919972535556",dealer_type:"",dealer_code:"1000050253",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727363",name:"KAVERI INFOTEK",phone:"+919845653675",dealer_type:"",dealer_code:"1000070113",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727371",name:"S r Battry service",phone:"+919738289633",dealer_type:"",dealer_code:"1000070351",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727387",name:"S S ENTERPRISES",phone:"+919739779917",dealer_type:"",dealer_code:"1000073322",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727395",name:"Av Power Systems and Services",phone:"+919880408640",dealer_type:"",dealer_code:"1000074031",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727407",name:"Sri Vigneshwara Automobiles",phone:"+919845269960",dealer_type:"",dealer_code:"1000077586",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727415",name:"Sri Laxmi BatteryandAuto Electrical Cent",phone:"+919845421341",dealer_type:"",dealer_code:"1000082657",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727423",name:"Auto Power Inc",phone:"+919986988999",dealer_type:"",dealer_code:"1000102581",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727431",name:"OM Durga Devi Darshan Battery",phone:"+918970075135",dealer_type:"",dealer_code:"1000102597",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727447",name:"SLN sphere solutions",phone:"+919880286269",dealer_type:"",dealer_code:"1000126307",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727455",name:"SRI RANGANATHA BATTERY POINT",phone:"+919845613618",dealer_type:"",dealer_code:"1000177172",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727471",name:"shivam power solution",phone:"+919844510641",dealer_type:"",dealer_code:"1000188873",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727479",name:"Power backup center",phone:"+918722111099",dealer_type:"",dealer_code:"1000188874",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727487",name:"RAVI ELECTRICAL",phone:"+919845198076",dealer_type:"",dealer_code:"1000188875",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727495",name:"BHARATH POWER SOLUTIONS",phone:"+919902029306",dealer_type:"",dealer_code:"1000188876",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727503",name:"SRS ENTERPRISES",phone:"+918867359670",dealer_type:"",dealer_code:"1000188877",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727511",name:"M/s ROOPA ENTERPRISES",phone:"+917483769659",dealer_type:"",dealer_code:"1000188878",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727519",name:"ozone power inc",phone:"+919964510444",dealer_type:"",dealer_code:"1000188879",city:"",state:"",address:"",dealer_meets:[]},
  {id:"1171062000002727527",name:"Sr power point",phone:"+919019363579",dealer_type:"",dealer_code:"1000189168",city:"",state:"",address:"",dealer_meets:[]},
];

// ── Main ───────────────────────────────────────────────────
async function main() {
  try {
    console.log("🔑 Getting Firebase ID token...");
    const idToken = await getIdToken();
    console.log("✅ Got token — seeding data...\n");

    const BATCH_SIZE = 10;
    let success = 0;
    let fail = 0;

    for (let i = 0; i < DEALERS.length; i += BATCH_SIZE) {
      const batch = DEALERS.slice(i, i + BATCH_SIZE);
      const docs = batch.map(d => ({
        id: d.id,
        data: {
          ...d,
          last_synced: { timestampValue: new Date().toISOString() },
          source: "zoho_crm_seeded",
        }
      }));

      try {
        await commitBatch(idToken, docs);
        console.log(`✅ Batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.map(d=>d.name).join(", ")}`);
        success += batch.length;
      } catch (err) {
        console.log(`❌ Batch failed: ${err.message}`);
        fail += batch.length;
      }

      if (i + BATCH_SIZE < DEALERS.length) await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n🎉 Done! ${success} seeded, ${fail} failed`);
  } catch (err) {
    console.error("Fatal error:", err.message);
    process.exit(1);
  }
}

main();