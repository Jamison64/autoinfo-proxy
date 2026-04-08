const axios = require("axios");

const USER_ID = "17292";
const AUTH_CODE = "LY9-P98-KK2";

const url = "http://test.autoinfo.com.au/API/AutoInfoGateway.asmx";

const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://autoi.com.au/">
  <soap:Body>
    <tns:GetStatusD>
      <tns:UserId>${USER_ID}</tns:UserId>
      <tns:AuthCode>${AUTH_CODE}</tns:AuthCode>
      <tns:UserCookie></tns:UserCookie>
    </tns:GetStatusD>
  </soap:Body>
</soap:Envelope>`;

async function testStatus() {
  try {
    const res = await axios.post(url, soapBody, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://autoi.com.au/GetStatusD",
      },
    });
    console.log("Response:", res.data);
  } catch (err) {
    console.error("Status:", err.response?.status);
    console.error("Response body:", err.response?.data);
  }
}

testStatus();
