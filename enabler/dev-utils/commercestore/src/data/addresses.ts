import type { Address } from '../types.ts';

export const ADDRESSES: Record<string, Address> = {
  AU: { firstName: 'James',   lastName: 'Wilson',      streetName: 'George Street',         streetNumber: '123',  city: 'Sydney',     postalCode: '2000',      region: 'NSW', phone: '+61291234567',   email: 'james.wilson@example.com.au' },
  AT: { firstName: 'Sophia',  lastName: 'Bauer',       streetName: 'Mariahilfer Straße',    streetNumber: '45',   city: 'Wien',       postalCode: '1060',             phone: '+43123456789',   email: 'sophia.bauer@example.at' },
  BE: { firstName: 'Lucas',   lastName: 'Dubois',      streetName: 'Rue de la Loi',         streetNumber: '16',   city: 'Bruxelles',  postalCode: '1040',             phone: '+3222345678',    email: 'lucas.dubois@example.be' },
  DK: { firstName: 'Emma',    lastName: 'Nielsen',     streetName: 'Nørrebrogade',          streetNumber: '78',   city: 'København',  postalCode: '2200',             phone: '+4512345678',    email: 'emma.nielsen@example.dk' },
  FI: { firstName: 'Mikael',  lastName: 'Korhonen',    streetName: 'Mannerheimintie',       streetNumber: '22',   city: 'Helsinki',   postalCode: '00100',            phone: '+358912345678',  email: 'mikael.korhonen@example.fi' },
  FR: { firstName: 'Marie',   lastName: 'Dupont',      streetName: 'Rue de Rivoli',         streetNumber: '55',   city: 'Paris',      postalCode: '75001',            phone: '+33123456789',   email: 'marie.dupont@example.fr' },
  DE: { firstName: 'Max',     lastName: 'Müller',      streetName: 'Unter den Linden',      streetNumber: '10',   city: 'Berlin',     postalCode: '10117',            phone: '+4930123456789', email: 'max.mueller@example.de' },
  JP: { firstName: 'Yuki',    lastName: 'Tanaka',      streetName: 'Shibuya',               streetNumber: '1-2-3', city: 'Tokyo',    postalCode: '150-0002', region: 'Tokyo', phone: '+81312345678',   email: 'yuki.tanaka@example.jp' },
  IT: { firstName: 'Giulia',  lastName: 'Rossi',       streetName: 'Via del Corso',         streetNumber: '32',   city: 'Roma',       postalCode: '00186',            phone: '+390612345678',  email: 'giulia.rossi@example.it' },
  NL: { firstName: 'Sven',    lastName: 'van der Berg', streetName: 'Damrak',               streetNumber: '100',  city: 'Amsterdam',  postalCode: '1012 LM',          phone: '+31201234567',   email: 'sven.berg@example.nl' },
  NO: { firstName: 'Lars',    lastName: 'Andersen',    streetName: 'Karl Johans gate',      streetNumber: '22',   city: 'Oslo',       postalCode: '0159',             phone: '+4712345678',    email: 'lars.andersen@example.no' },
  PL: { firstName: 'Anna',    lastName: 'Kowalska',    streetName: 'Nowy Świat',            streetNumber: '15',   city: 'Warszawa',   postalCode: '00-029',           phone: '+48221234567',   email: 'anna.kowalska@example.pl' },
  PT: { firstName: 'Joana',   lastName: 'Ferreira',    streetName: 'Avenida da Liberdade',  streetNumber: '200',  city: 'Lisboa',     postalCode: '1250-096',         phone: '+351211234567',  email: 'joana.ferreira@example.pt' },
  ES: { firstName: 'Carlos',  lastName: 'García',      streetName: 'Gran Vía',              streetNumber: '40',   city: 'Madrid',     postalCode: '28013',            phone: '+34911234567',   email: 'carlos.garcia@example.es' },
  SE: { firstName: 'Astrid',  lastName: 'Lindqvist',   streetName: 'Drottninggatan',        streetNumber: '50',   city: 'Stockholm',  postalCode: '111 21',           phone: '+46812345678',   email: 'astrid.lindqvist@example.se' },
  CH: { firstName: 'Hans',    lastName: 'Keller',      streetName: 'Bahnhofstrasse',        streetNumber: '20',   city: 'Zürich',     postalCode: '8001',             phone: '+41441234567',   email: 'hans.keller@example.ch' },
  GB: { firstName: 'Oliver',  lastName: 'Smith',       streetName: 'Baker Street',          streetNumber: '221B', city: 'London',     postalCode: 'NW1 6XE',          phone: '+442071234567',  email: 'oliver.smith@example.co.uk' },
  US: { firstName: 'Sarah',   lastName: 'Johnson',     streetName: 'Broadway',              streetNumber: '350',  city: 'New York',   postalCode: '10013', region: 'NY', phone: '+12125551234',   email: 'sarah.johnson@example.com' },
};
