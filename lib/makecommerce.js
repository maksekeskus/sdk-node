"use strict";

const crypto = require('crypto');
const request = require('request');
const Promise = require('bluebird');
const _ = require('lodash');

class Makecommerce {

    static get SIGNATURE_TYPE_1() { return 'V1'; }
    static get SIGNATURE_TYPE_2() { return 'V2'; }
    static get SIGNATURE_TYPE_MAC() { return 'MAC'; }

    constructor(shop_id, publishable_key, secret_key, test_env) {
        if (!shop_id) throw new Error('Shop ID is mandatory field');
        if (!publishable_key) throw new Error('Publishable key is mandatory field');
        if (!secret_key) throw new Error('Secret key is mandatory field');
        this.shop_id = shop_id;
        this.publishable_key = publishable_key;
        this.secret_key = secret_key;

        this.api_url = test_env ? 'https://api.test.maksekeskus.ee' : 'https://api.maksekeskus.ee';
        this.env_urls = {};
        this.env_urls.api = test_env ? 'https://api.test.maksekeskus.ee' : 'https://api.maksekeskus.ee';
        this.env_urls.checkoutjs = test_env ? 'https://payment.test.maksekeskus.ee/checkout/dist/' : 'https://payment.maksekeskus.ee/checkout/dist/';
        this.env_urls.gateway = test_env ? 'https://payment.test.maksekeskus.ee/pay/1/signed.html' : 'https://payment.maksekeskus.ee/pay/1/signed.html';
        this.env_urls.statics = test_env ? 'https://static-test.maksekeskus.ee/' : 'https://static.maksekeskus.ee/';
    };

    get envUrls() {
        return this.env_urls;
    }

    get apiUrl() {
        return this.api_url;
    }

    get shopId() {
        return this.shop_id;
    }

    extractRequestData(request) {

        if (!request || !request.json) {
            throw new Error("Unable to extract data from request");
        }

        const data = JSON.parse(request.json);

        if (!data) {
            throw new Error("Empty data");
        }

        return data;
    }

    extractRequestSignatureType(request) {
        const data = this.extractRequestData(request);
        if (data.signature) {
            if (!data.transaction) {
                return this.SIGNATURE_TYPE_1;
            }
            return this.SIGNATURE_TYPE_2
        }
        return null;
    }

    extractRequestSignature(request) {
        const data = this.extractRequestData(request);
        return data ? data.signature || null : null;
    }

    extractRequestMac(request) {
        return request ? request.mac || null : null;
    }

    createMacHash(str) {
        return crypto.createHash('sha512').update(str + this.secret_key).digest('hex').toUpperCase();
    }

    getMacInput(data, signature_type) {

        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        if (signature_type === this.SIGNATURE_TYPE_MAC) {
            return JSON.stringify(data);
        }

        const use_parts = signature_type === this.SIGNATURE_TYPE_2 ? ['amount', 'currency', 'reference', 'transaction', 'status'] : ['paymentId', 'amount', 'status'];

        let mac_input = '';

        use_parts.forEach((part) => {
            mac_input += typeof data[part] === 'boolean' ? data[part] ? 'true' : 'false' : data[part] || '';
        });

        return mac_input;

    }

    composeSignature(data, signature_type) {
        const mac_input = this.getMacInput(data, signature_type);
        return this.createMacHash(mac_input);
    }

    composeEmbeddedSignature(amount, currency, reference) {
        const mac_input = (amount || 0).toString() + (currency || '').toString() + (reference || '').toString();
        return this.createMacHash(mac_input);
    }

    composeMac(data) {
        const mac_input = this.getMacInput(data, this.SIGNATURE_TYPE_MAC);
        return this.createMacHash(mac_input);
    }

    verifyMac(request) {
        try {
            const received = this.extractRequestMac(request);
            const expected = this.composeMac(this.extractRequestData(request));
            return received === expected;
        } catch (e) {
            return false;
        }
    }

    verifySignature(request) {
        try {
            const received = this.extractRequestSignature(request);
            const expected = this.composeSignature(this.extractRequestData(request), this.extractRequestSignatureType(request));
            return received === expected;
        } catch (e) {
            return false;
        }
    }

    makeGetRequest(endpoint, params) {
        params = params || {};
        return this.makeApiRequest('GET', endpoint, params);
    }

    makePostRequest(endpoint, params) {
        params = params || {};
        return this.makeApiRequest('POST', endpoint, null, params);
    }

    makePutRequest(endpoint, params, body) {
        params = params || {};
        return this.makeApiRequest('PUT', endpoint, params, body);
    }

    makeApiRequest(method, endpoint, params, body, cb) {

        return new Promise((resolve, reject) => {

            cb = cb || function () { };
            body = body || '';

            let uri = this.apiUrl + endpoint;
            _.each((params || {}), (value, key) => {
                uri += uri.indexOf('?') < 0 ? '?' : '&';
                uri += encodeURIComponent(key) + '=' + encodeURIComponent(value);
            });

            request({
                uri: uri,
                method: method,
                auth: {
                    user: this.shopId,
                    pass: this.secret_key,
                },
                body: body,
                json: true
            }, (err, response, body) => {
                if (err) { reject(err); return cb(err) ;}
                this.last_api_response = body;
                cb(resolve(body));
            });
        });

    }

    get lastApiResponse() {
        return this.last_api_response || '';
    }

    getShop() {
        return this.makeGetRequest('/v1/shop');
    }

    getShopConfig(environment) {
        return this.makeGetRequest('/v1/shop/configuration', environment);
    }

    updateShop(body) {
        return this.makePostRequest('/v1/shop', null, body);
    }

    createTransaction(params) {
        return this.makePostRequest('/v1/transactions', params);
    }

    addTransactionMeta(transaction_id, params) {
        return this.makePostRequest('/v1/transactions/'+transaction_id+'/addMeta', params);
    }

    getTransaction(transaction_id) {
        return this.makeGetRequest('/v1/transactions/'+transaction_id);
    }

    getTransactions(params) {
        return this.makeGetRequest('/v1/transactions', params);
    }

    createToken(params) {
        return this.makePostRequest('/v1/tokens', params);
    }

    createPayment(transaction_id, params) {
        return this.makePostRequest('/v1/transactions/'+transaction_id+'/payments', params);
    }

    createRefund(transaction_id, params) {
        return this.makePostRequest('/v1/transactions/'+transaction_id+'/refunds', params);
    }

    getRefund(refund_id) {
        return this.makeGetRequest('/v1/refunds/'+refund_id);
    }

    getRefunds(params) {
        return this.makeGetRequest('/v1/refunds', params);
    }

    getPaymentMethods(params) {
        return this.makeGetRequest('/v1/methods', params);
    }

    getDestinations(params) {
        return this.makePostRequest('/v1/shipments/destinations', params)
    }

    createShipments(params) {
        return this.makePostRequest('/v1/shipments', params);
    }

    getLabelFormats() {
        return this.makeGetRequest('/v1/shipments/labels/formats');
    }

    createLabels(params) {
        return this.makePostRequest('/v1/shipments/createlabels', params);
    }

    createCart(params) {
        return this.makePostRequest('/v1/carts', params);
    }

}

module.exports = Makecommerce;
