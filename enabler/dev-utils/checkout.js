let ckoCartId = null;

const getCart = async () => {
  const url = `${__VITE_CTP_API_URL__}/${projectKey}/carts/${ckoCartId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return await res.json();
};

const getShippingMethods = async (opts) => {
  const url = `${__VITE_CTP_API_URL__}/${projectKey}/shipping-methods/matching-cart?cartId=${ckoCartId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await res.json();

  return data.results.map((method) => {
    const shippingOption = {
      id: method.id,
      name: method.name,
      description: method.localizedName[0],
      isSelected: method.isDefault,
    };

    const zoneRate = method.zoneRates[0].shippingRates.find((rate) => rate.isMatching);

    shippingOption.amount = {
      centAmount: zoneRate.price.centAmount,
      currencyCode: zoneRate.price.currencyCode,
    };

    return shippingOption;
  });
};

const setShippingMethod = async (opts) => {
  const url = `${__VITE_CTP_API_URL__}/${projectKey}/carts/${ckoCartId}`;
  const cart = await getCart();

  const payload = {
    version: cart.version,
    actions: [
      {
        action: "setShippingMethod",
        shippingMethod: {
          id: opts.shippingOption.id,
          typeId: "shipping-method",
        },
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  console.log("Set shipping method", data);

  return data;
};

const setShippingAddress = async (opts) => {
  const url = `${__VITE_CTP_API_URL__}/${projectKey}/carts/${ckoCartId}`;
  const cart = await getCart();

  
  const payload = {
    version: cart.version,
    actions: [
      {
        action: "setShippingAddress",
        address: {
          country: opts.address.country,
          postalCode: opts.address.postalCode,
          city: opts.address.city,
          firstName: opts.address.firstName,
          lastName: opts.address.lastName,
          streetName: opts.address.streetName,
          streetNumber: opts.address.streetNumber,
          additionalStreetInfo: opts.address.additionalStreetInfo,
          region: opts.address.region,
          phone: opts.address.phone,
          email: opts.address.email,
        },
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  console.log("Set shipping address", data);

  return data;
};

const setBillingAddress = async (opts) => {
  const url = `${__VITE_CTP_API_URL__}/${projectKey}/carts/${ckoCartId}`;
  const cart = await getCart();

  const payload = {
    version: cart.version,
    actions: [
      {
        action: "setBillingAddress",
        address: {
          country: opts.address.country,
          postalCode: opts.address.postalCode,
          city: opts.address.city,
          firstName: opts.address.firstName,
          lastName: opts.address.lastName,
          streetName: opts.address.streetName,
          streetNumber: opts.address.streetNumber,
          additionalStreetInfo: opts.address.additionalStreetInfo,
          region: opts.address.region,
          phone: opts.address.phone,
          email: opts.address.email,
        },
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  console.log("Set billing address", data);

  return data;
};
