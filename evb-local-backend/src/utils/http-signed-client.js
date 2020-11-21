const axios = require("axios");
const aws4 = require("aws4");

const baseurl = process.env.ApiBaseUrl;
const region = process.env.AWS_REGION || "eu-west-1";

const post = async (path, data) => {
  const request = buildRequest("POST", path, data);
  const signedRequest = signRequest(request);
  return axios(signedRequest);
};

const get = async (path) => {
  const request = buildRequest("GET", path);
  const signedRequest = signRequest(request);
  return axios(signedRequest);
};

const signRequest = (request) => {
  const signedRequest = aws4.sign(request);
  delete signedRequest.headers["Host"];
  delete signedRequest.headers["Content-Length"];
  return signedRequest;
};

const buildRequest = (method, path, data) => {
  if (!baseurl) {
    throw Error('Environment variable "ApiBaseUrl" is not set!');
  }

  const request = {
    host: baseurl,
    method: method,
    url: `https://${baseurl}/${path}`,
    path: path,
    region: region,
    headers: {
      "content-type": "application/json",
    },
    service: "execute-api",
  };

  if (data) {
    const body = JSON.stringify(data);
    request["data"] = data;
    request["body"] = body;
  }

  return request;
};

module.exports = {
  post: post,
  get: get,
};
