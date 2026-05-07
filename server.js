require("dotenv").config();

const http = require("http");
const https = require("https");
const xml2js = require("xml2js");

const PORT = process.env.PORT || 3000;

const BC_STORE_HASH = process.env.BC_STORE_HASH || "";
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN || "";

const USER_ID = "17292";
const AUTH_CODE = "LY9-P98-KK2";
const AUTOINFO_HOST = "http://test.autoinfo.com.au";

/* ============================================================
   CORS — allowed origins
============================================================ */
const ALLOWED_ORIGINS = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://www.westernfilters.com.au",
  "https://westernfilters.com.au",
];

function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function vehicleQuery(
  returnField,
  make = "",
  model = "",
  year = "",
  seriesChassis = "",
  engine = "",
) {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:VehicleQueryD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:ReturnField>${returnField}</tns:ReturnField>
      <tns:Make>${make}</tns:Make>
      <tns:Model>${model}</tns:Model>
      <tns:Year>${year}</tns:Year>
      <tns:SeriesChassis>${seriesChassis}</tns:SeriesChassis>
      <tns:Engine>${engine}</tns:Engine>
      <tns:AU>true</tns:AU>
      <tns:NZ>true</tns:NZ>
      <tns:PA>true</tns:PA>
      <tns:LC>true</tns:LC>
      <tns:MC>false</tns:MC>
      <tns:HC>false</tns:HC>
      <tns:SeriesCheck>false</tns:SeriesCheck>
      <tns:ChassisCheck>false</tns:ChassisCheck>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:VehicleQueryD>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/VehicleQueryD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };

    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });

    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

/* ============================================================
   REGO LOOKUP — VehicleByLicencePlateD
============================================================ */
function vehicleByRego(plate, state) {
  return new Promise((resolve, reject) => {
    const country = state.startsWith("NZ") ? "NZ" : "AU";
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:VehicleByLicencePlateD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:Country>${country}</tns:Country>
      <tns:State>${state}</tns:State>
      <tns:Licenceplate>${plate}</tns:Licenceplate>
      <tns:AcceptCharge>1</tns:AcceptCharge>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:VehicleByLicencePlateD>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/VehicleByLicencePlateD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };

    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });

    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

function parseRegoResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const body = result["soap:Envelope"]["soap:Body"];
        if (body["soap:Fault"]) return resolve(null);

        const response =
          body["VehicleByLicencePlateDResponse"][
            "VehicleByLicencePlateDResult"
          ];

        const status = response["VRQReturnStatus"];
        if (!status || status["Status"] === "0") return resolve(null);

        const vrqResult = response["VRQResult"];
        if (!vrqResult) return resolve(null);

        const raw = vrqResult["VRQResult"];
        if (!raw) return resolve(null);

        const list = Array.isArray(raw) ? raw : [raw];

        const vehicles = list.map((v) => ({
          id: v.VehicleId,
          make: v.Make,
          model: v.Model,
          year: v.Year,
          chassis: v.SeriesChassis || "",
          engine: v.Engine || "",
          details: v.Details || "",
          label: v.VehicleDescription || `${v.Make} ${v.Model} ${v.Year}`,
        }));

        resolve(vehicles.length === 1 ? vehicles[0] : vehicles);
      } catch (e) {
        reject(new Error("Failed to parse rego XML: " + e.message));
      }
    });
  });
}

function getParts(vehicleId, partGroup = 0, subGroup = 0) {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:PartsListD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:CatType>1</tns:CatType>
      <tns:VehicleID>${vehicleId}</tns:VehicleID>
      <tns:PartGroup>${partGroup}</tns:PartGroup>
      <tns:SubGroup>${subGroup}</tns:SubGroup>
      <tns:Layout>0</tns:Layout>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:PartsListD>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/PartsListD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };

    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });

    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

function smartSearch(searchString) {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:SmartSearchD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:CatType>1</tns:CatType>
      <tns:SearchString>${searchString}</tns:SearchString>
      <tns:AU>true</tns:AU>
      <tns:NZ>true</tns:NZ>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:SmartSearchD>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/SmartSearchD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };

    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });

    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

function getXrefProducts(partNo) {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:GetXrefProductsD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:CatType>1</tns:CatType>
      <tns:InputPartno>${partNo}</tns:InputPartno>
      <tns:Layout>0</tns:Layout>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:GetXrefProductsD>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/GetXrefProductsD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };

    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });

    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

function getPartGroupsSubGroupsSubcats() {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:PartGroupsSubGroupsSubcatsD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:CatType>1</tns:CatType>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:PartGroupsSubGroupsSubcatsD>
  </soap:Body>
</soap:Envelope>`;
    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/PartGroupsSubGroupsSubcatsD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };
    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });
    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

function getVehiclesByPartSku(sku) {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:VehiclesByPartSkuD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:SKU>${sku}</tns:SKU>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:VehiclesByPartSkuD>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/VehiclesByPartSkuD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };

    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });

    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

function parseVehicleResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const body = result["soap:Envelope"]["soap:Body"];
        if (body["soap:Fault"]) return resolve([]);
        const queryResult = body["VehicleQueryDResponse"]["VehicleQueryDResult"];
        if (!queryResult || !queryResult["VehicleResult"]) return resolve([]);
        const raw = queryResult["VehicleResult"]["VehicleResult"];
        if (!raw) return resolve([]);
        const results = Array.isArray(raw) ? raw : [raw];
        const items = results.map((item) => ({
          text: item.SelectText,
          vehicleId: item.VehicleId,
        }));
        resolve(items);
      } catch (e) {
        reject(new Error("Failed to parse XML structure: " + e.message));
      }
    });
  });
}

function parsePartsResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const response =
          result["soap:Envelope"]["soap:Body"]["PartsListDResponse"][
            "PartsListDResult"
          ];
        const recordsReturned = response["RecordsReturned"];
        const recordsAvailable = response["RecordsAvailable"];
        let parts = [];
        if (response["Parts"] && response["Parts"]["PartsListing"]) {
          const raw = response["Parts"]["PartsListing"];
          const list = Array.isArray(raw) ? raw : [raw];
          parts = list.map((item) => ({
            sku: item.SKU,
            partNo: item.Partno,
            partId: item.Partid,
            brand: item.Brand,
            subCatDescription: item.SubCatDescription,
            longFootnote: item.LongFootnote,
            aapi: item.AAPI,
            pcq: item.PCQ,
            hasImage: item.HasImage,
            thumbImageUrl: item.thumbimageurl
              ? `${AUTOINFO_HOST}${item.thumbimageurl}`
              : null,
            brandLogoUrl: item.brandlogourl
              ? `${AUTOINFO_HOST}${item.brandlogourl}`
              : null,
          }));
        }
        resolve({ recordsReturned, recordsAvailable, parts });
      } catch (e) {
        reject(new Error("Failed to parse parts XML: " + e.message));
      }
    });
  });
}

function parseXrefResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const body = result["soap:Envelope"]["soap:Body"];
        if (body["soap:Fault"]) return resolve({ parts: [] });

        const response =
          body["GetXrefProductsDResponse"]["GetXrefProductsDResult"];
        const recordsReturned = response["RecordsReturned"];
        const recordsAvailable = response["RecordsAvailable"];
        let parts = [];
        if (response["Parts"] && response["Parts"]["PartsListing"]) {
          const raw = response["Parts"]["PartsListing"];
          const list = Array.isArray(raw) ? raw : [raw];
          parts = list.map((item) => ({
            sku: item.SKU,
            partNo: item.Partno,
            partId: item.Partid,
            brand: item.Brand,
            subCatDescription: item.SubCatDescription,
            longFootnote: item.LongFootnote,
            aapi: item.AAPI,
            pcq: item.PCQ,
            hasImage: item.HasImage,
            thumbImageUrl: item.thumbimageurl
              ? `${AUTOINFO_HOST}${item.thumbimageurl}`
              : null,
          }));
        }
        resolve({ recordsReturned, recordsAvailable, parts });
      } catch (e) {
        reject(new Error("Failed to parse xref XML: " + e.message));
      }
    });
  });
}

/* ============================================================
   AUTOINFO — GetPartDetailsSkuD (look up by WF/distributor SKU)
============================================================ */
function getPartDetailsSku(sku) {
  return new Promise((resolve, reject) => {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:GetPartDetailsSkuD>
      <tns:UserID>${USER_ID}</tns:UserID>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:SKU>${sku}</tns:SKU>
      <tns:CallingIPAddress>1.1.1.1</tns:CallingIPAddress>
      <tns:UserCookie></tns:UserCookie>
      <tns:UserAccount>Debtor123</tns:UserAccount>
    </tns:GetPartDetailsSkuD>
  </soap:Body>
</soap:Envelope>`;
    const options = {
      hostname: "test.autoinfo.com.au",
      path: "/API/AutoInfoGateway.asmx",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/GetPartDetailsSkuD",
        "Content-Length": Buffer.byteLength(soapBody),
      },
    };
    const req = http.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => resolve(data));
    });
    req.on("error", (err) => reject(err));
    req.write(soapBody);
    req.end();
  });
}

function parsePartDetailsResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const body = result["soap:Envelope"]["soap:Body"];
        if (body["soap:Fault"]) return resolve({ parts: [] });
        const response = body["GetPartDetailsSkuDResponse"]["GetPartDetailsSkuDResult"];
        let parts = [];
        if (response && response["Parts"] && response["Parts"]["PartsListing"]) {
          const raw = response["Parts"]["PartsListing"];
          const list = Array.isArray(raw) ? raw : [raw];
          parts = list.map((item) => ({
            sku: item.SKU,
            partNo: item.Partno,
            brand: item.Brand,
            subCatDescription: item.SubCatDescription,
            longFootnote: item.LongFootnote || "",
            partDescription: item.PartDescription || "",
            aapi: item.AAPI,
            thumbImageUrl: item.thumbimageurl
              ? `${AUTOINFO_HOST}${item.thumbimageurl}`
              : null,
            brandLogoUrl: item.brandlogourl
              ? `${AUTOINFO_HOST}${item.brandlogourl}`
              : null,
          }));
        }
        resolve({ parts });
      } catch (e) {
        resolve({ parts: [] });
      }
    });
  });
}

function parsePartGroupsResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const body = result["soap:Envelope"]["soap:Body"];
        if (body["soap:Fault"]) return resolve({ groups: {} });
        const raw = body["PartGroupsSubGroupsSubcatsDResponse"]["PartGroupsSubGroupsSubcatsDResult"]["PartGroupSubGroupResult"]["PartGroupSubGroupSubcat"];
        const list = Array.isArray(raw) ? raw : [raw];
        // Build nested map: partGroup -> subGroup -> [subCat]
        const groups = {};
        list.forEach(item => {
          const pg = item.PartGroupDescription || "Other";
          const sg = item.SubGroupDescription || "Other";
          const sc = item.SubCatDescription || "Other";
          if (!groups[pg]) groups[pg] = {};
          if (!groups[pg][sg]) groups[pg][sg] = [];
          if (!groups[pg][sg].includes(sc)) groups[pg][sg].push(sc);
        });
        resolve({ groups });
      } catch (e) {
        resolve({ groups: {} });
      }
    });
  });
}

/* ============================================================
   BIGCOMMERCE — Batch title lookup (sku:in filter, one call)
   Resolves to { sku: productName } map. Never rejects — falls back to AutoInfo data gracefully.
============================================================ */
function bcBatchTitles(skus) {
  return new Promise((resolve) => {
    if (!BC_STORE_HASH || !BC_ACCESS_TOKEN || !skus.length) return resolve({});
    const skuList = skus.map((s) => encodeURIComponent(s)).join(",");
    const reqPath = `/stores/${BC_STORE_HASH}/v3/catalog/products?sku:in=${skuList}&limit=250`;
    const options = {
      hostname: "api.bigcommerce.com",
      path: reqPath,
      method: "GET",
      headers: {
        "X-Auth-Token": BC_ACCESS_TOKEN,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    };
    const req = https.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        try {
          const json = JSON.parse(data);
          const map = {};
          (json.data || []).forEach((p) => {
            map[p.sku] = { name: p.name, price: p.price || null, salePrice: p.sale_price || null };
          });
          resolve(map);
        } catch (e) {
          resolve({});
        }
      });
    });
    req.on("error", () => resolve({}));
    req.end();
  });
}

/* ============================================================
   BIGCOMMERCE — Part Number Search
============================================================ */
function bcSearchBySku(sku) {
  return new Promise((resolve, reject) => {
    if (!BC_STORE_HASH || !BC_ACCESS_TOKEN) {
      return reject(
        new Error(
          "BC credentials not set. Add BC_STORE_HASH and BC_ACCESS_TOKEN to .env",
        ),
      );
    }
    const reqPath = `/stores/${BC_STORE_HASH}/v3/catalog/products?sku=${encodeURIComponent(sku)}&include=images`;
    const options = {
      hostname: "api.bigcommerce.com",
      path: reqPath,
      method: "GET",
      headers: {
        "X-Auth-Token": BC_ACCESS_TOKEN,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    };
    const req = https.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse BC response: " + e.message));
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.end();
  });
}

function parseBcSearchResults(json) {
  const products = json.data || [];
  const parts = products.map((product) => {
    const images = product.images || [];
    const thumb = images.find((img) => img.is_thumbnail) || images[0];
    return {
      sku: "",
      partNo: product.sku,
      partId: String(product.id),
      brand: "",
      subCatDescription: "",
      longFootnote: "",
      title: product.name,
      aapi: product.bin_picking_number || "",
      pcq: null,
      hasImage: images.length > 0,
      thumbImageUrl: thumb ? thumb.url_thumbnail : null,
      price: product.price,
      salePrice: product.sale_price || null,
      bcProductId: product.id,
      source: "bc",
    };
  });
  return {
    recordsReturned: parts.length,
    recordsAvailable: parts.length,
    parts,
  };
}

function parseVehicleAppsResults(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      try {
        const body = result["soap:Envelope"]["soap:Body"];
        if (body["soap:Fault"]) return resolve([]);

        const wrapper = body["VehiclesByPartSkuDResponse"];
        const response = wrapper && wrapper["VehiclesByPartSkuDResult"];
        if (!response) return resolve([]);
        const vehicleResult = response["VehicleResult"];
        if (!vehicleResult) return resolve([]);

        const raw = vehicleResult["VehicleResult"];
        if (!raw) return resolve([]);

        const list = Array.isArray(raw) ? raw : [raw];
        const vehicles = list.map((v) => ({
          id: v.VehicleId,
          make: v.Make,
          model: v.Model,
          year: v.Year,
          chassis: v.SeriesChassis,
          engine: v.Engine,
          details: v.Details,
          label: [v.Make, v.Model, v.Year, v.SeriesChassis, v.Engine, v.Details]
            .filter(Boolean)
            .join(" "),
        }));
        resolve(vehicles);
      } catch (e) {
        reject(new Error("Failed to parse vehicle apps XML: " + e.message));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const path = parsedUrl.pathname;
  const params = parsedUrl.searchParams;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    setCORSHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Set CORS headers on all responses
  setCORSHeaders(req, res);

  if (path === "/myip") {
    https.get("https://api.ipify.org?format=json", (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      });
    });
  } else if (path === "/makes") {
    try {
      const xml = await vehicleQuery("Make");
      const makes = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(makes));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/models") {
    const make = params.get("make") || "";
    try {
      const xml = await vehicleQuery("Model", make);
      const models = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(models));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/years") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    try {
      const xml = await vehicleQuery("Year", make, model);
      const years = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(years));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/serieschassis") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    const year = params.get("year") || "";
    try {
      const xml = await vehicleQuery("SeriesChassis", make, model, year);
      const series = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(series));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/engine") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    const year = params.get("year") || "";
    const seriesChassis = params.get("seriesChassis") || "";
    try {
      const xml = await vehicleQuery(
        "Engine",
        make,
        model,
        year,
        seriesChassis,
      );
      const engines = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(engines));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/details") {
    const make = params.get("make") || "";
    const model = params.get("model") || "";
    const year = params.get("year") || "";
    const seriesChassis = params.get("seriesChassis") || "";
    const engine = params.get("engine") || "";
    try {
      const xml = await vehicleQuery(
        "Details",
        make,
        model,
        year,
        seriesChassis,
        engine,
      );
      const details = await parseVehicleResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(details));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/rego") {
    const plate = (params.get("plate") || "").toUpperCase().trim();
    const place = params.get("place") || "";
    // Convert AU-NSW → NSW for AutoInfo
    const state = place.replace("AU-", "").replace("NZ-", "NZ");
    try {
      const xml = await vehicleByRego(plate, state);
      const result = await parseRegoResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/rego-raw") {
    const plate = (params.get("plate") || "").toUpperCase().trim();
    const place = params.get("place") || "";
    const state = place.replace("AU-", "").replace("NZ-", "NZ");
    try {
      const xml = await vehicleByRego(plate, state);
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/parts") {
    const vehicleId = params.get("vehicleId") || "";
    const partGroup = params.get("partGroup") || 0;
    const subGroup = params.get("subGroup") || 0;
    try {
      const xml = await getParts(vehicleId, partGroup, subGroup);
      const result = await parsePartsResults(xml);
      // Enrich each part with BC product title (one batch call)
      const skus = result.parts.map((p) => p.partNo).filter(Boolean);
      const titleMap = await bcBatchTitles(skus);
      result.parts.forEach((p) => {
        const d = titleMap[p.partNo];
        if (d) { p.title = d.name || ""; p.price = d.price; p.salePrice = d.salePrice; }
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/parts/search") {
    const partNo = (params.get("partno") || params.get("partNo") || "").trim();
    if (!partNo) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "partNo required" }));
      return;
    }
    try {
      // Step 1: BC result + xref fallback in parallel
      const [bcJson, xrefXml] = await Promise.all([
        bcSearchBySku(partNo),
        getXrefProducts(partNo).catch(() => null),
      ]);
      const result = parseBcSearchResults(bcJson);

      // Step 2: Use BC aapi (= AutoInfo internal SKU) to call GetPartDetailsSkuD
      const aapis = [...new Set(result.parts.map((p) => p.aapi).filter(Boolean))];
      const aiByAapi = {};
      if (aapis.length > 0) {
        const pdXmls = await Promise.all(
          aapis.map((a) => getPartDetailsSku(a).catch(() => null))
        );
        for (let i = 0; i < aapis.length; i++) {
          if (pdXmls[i]) {
            const pd = await parsePartDetailsResults(pdXmls[i]);
            if (pd.parts.length > 0) aiByAapi[aapis[i]] = pd.parts[0];
          }
        }
      }

      // Step 3: Enrich BC parts with AutoInfo data
      result.parts = result.parts.map((bcPart) => {
        const ai = aiByAapi[bcPart.aapi] || null;
        if (ai) {
          return {
            ...bcPart,
            subCatDescription: ai.subCatDescription || "",
            longFootnote: ai.longFootnote || "",
            sku: ai.sku || "",
            brand: ai.brand || bcPart.brand,
            brandLogoUrl: ai.brandLogoUrl || null,
            thumbImageUrl: bcPart.thumbImageUrl || ai.thumbImageUrl || null,
          };
        }
        return bcPart;
      });

      // Step 4: GetXrefProductsD fallback for any parts still missing enrichment
      const needsEnrichment = result.parts.some((p) => !p.subCatDescription);
      if (needsEnrichment && xrefXml) {
        const xref = await parseXrefResults(xrefXml);
        if (xref.parts.length > 0) {
          result.parts = result.parts.map((bcPart) => {
            if (bcPart.subCatDescription) return bcPart;
            const ai =
              xref.parts.find((p) => p.partNo === bcPart.partNo) || xref.parts[0];
            return {
              ...bcPart,
              subCatDescription: ai.subCatDescription || "",
              longFootnote: ai.longFootnote || "",
              sku: ai.sku || "",
              brand: ai.brand || bcPart.brand,
              aapi: bcPart.aapi || ai.aapi || "",
              thumbImageUrl: bcPart.thumbImageUrl || ai.thumbImageUrl || null,
            };
          });
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/vehicle-apps") {
    const sku = (params.get("aapi") || params.get("sku") || "").trim();
    if (!sku) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "sku required" }));
      return;
    }
    try {
      const xml = await getVehiclesByPartSku(sku);
      const vehicles = await parseVehicleAppsResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(vehicles));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/parts-search-raw") {
    const q = (params.get("partno") || params.get("partNo") || "").trim();
    try {
      const xml = await smartSearch(q);
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/part-details-raw") {
    const q = (params.get("partno") || params.get("partNo") || "").trim();
    try {
      const xml = await getPartDetailsSku(q);
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/xref-raw") {
    const q = (params.get("partno") || params.get("partNo") || "").trim();
    try {
      const xml = await getXrefProducts(q);
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/vehicle-apps-raw") {
    const sku = (params.get("sku") || "").trim();
    try {
      const xml = await getVehiclesByPartSku(sku);
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/part-groups") {
    try {
      const xml = await getPartGroupsSubGroupsSubcats();
      const parsed = await parsePartGroupsResults(xml);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(parsed, null, 2));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/part-groups-raw") {
    try {
      const xml = await getPartGroupsSubGroupsSubcats();
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (path === "/parts-raw") {
    const vehicleId = params.get("vehicleId") || "";
    try {
      const xml = await getParts(vehicleId);
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(xml);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "AutoInfo Proxy Running" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
