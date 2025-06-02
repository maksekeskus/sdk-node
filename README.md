> [!WARNING]
> This SDK is currently severly outdated and its usage is discouraged, use at own risk only.


sdk-node
========

# Installation

Add `makecommerce-sdk` to your packages.json to include the library.

# Usage

Makecommerce SDK returns only promises and promise chains. You can not use callbacks.

## Initialise the library

To use the library you need to provide shop_id, public_key, secret_key of the store that you get from Makecommerce portal.

```javascript
const MKSDK = require('makecommerce-sdk');
const MKAPI = new MKSDK('shop_id', 'public_key', 'secret_key', true /* false or omit for live environment */);
```

## Create transaction

To create payment or initialize checkout.js payment, you need transaction ID, easiest way to get it is to call `createTransaction`.

```javascript
MKAPI.createTransaction({
	transaction: {
		amount: '1.00',
		currency: 'EUR',
		reference: 'My reference ID'
	},
	customer: {
		email: 'customer@email.com',
		ip: '123.123.123.123',
		country: 'EE',
		locale: 'en'
	}
}).then((transaction) => {
	console.log('Transaction ['+transaction.id+'] created');
}).catch((err) => {
	console.error(err.toString())
});
```

## Create payment

For payment creation on server side with payment token you use `createPayment` call.

```javascript
MKAPI.createPayment(transaction.id, {amount: '1.00', currency: 'EUR', token: 'payment-token-from-checkout'}).then((payment) => {
	console.log('Payment ['+payment.id+'] created');
}).catch((err) => {
	console.error('Error creating payment ['+err.toString()+']');
});
```


