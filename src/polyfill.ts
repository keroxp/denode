const _Deno = require("./deno");
const { Base64 } = require("js-base64");
const _fetch = require("node-fetch");
const _url = require("url");
global["fetch"] = _fetch;
global["Headers"] = _fetch.Headers;
global["Request"] = _fetch.Request;
global["Response"] = _fetch.Response;
global["URL"] = _url.URL;
global["URLSearchParams"] = _url.URLSearchParams;
global["atob"] = Base64.atob;
global["btoa"] = Base64.btoa;
global["Deno"] = _Deno;
global["StringDecoder"] = class StringDecoder {
  decode(s: Uint8Array): string {
    return new Buffer(s).toString();
  }
};
global["StringEncoder"] = class StringEncoder {
  encode(s: string): Uint8Array {
    return new Buffer(s);
  }
};
