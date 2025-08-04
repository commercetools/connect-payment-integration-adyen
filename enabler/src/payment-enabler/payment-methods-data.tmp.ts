const CocoIdToAdyenId = {
  "s1": "QV5P9PGRCB9V3575",
  "s2": "KNF9S4ZT5QQC7Z65",
  "s3": "BXTFL42RCB9V3575",
}

export const getAdyenIdFromCocoId = (cocoId: string): string | undefined => {
  return CocoIdToAdyenId[cocoId];
}

export const storedPaymentMethods = [{
  id: "s1",
  type: "card",
  displayOptions: {
    name: "**** 1111",
    endDigits: "1111",
    brand: "visa",
    // expiryDate: "12/25",
  },
}, {
  id: "s2",
  type: "card",
  displayOptions: {
    name: "**** 5454",
    endDigits: "5454",
    brand: "mc",
    expiryDate: "12/25",
  }
}, {
  id: "s3",
  type: "card",
  displayOptions: {
    name: "**** 1111 (2)",
    endDigits: "1111",
    brand: "visa",
    expiryDate: "12/25",
  }
}, {
  id: "NP2B7V24QKNLZK75",
  type: "sepadirectdebit",
  displayOptions: {
    name: "SEPA Direct Debit",
    logoUrl: "https://checkoutshopper-test.adyen.com/checkoutshopper/images/icons/sepa.svg",
  }
}]
