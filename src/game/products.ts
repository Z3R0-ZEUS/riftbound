/** Fan packaging art for credits. Not a store — every deck is already in the box. */

export interface ProductArt {
  id: string;
  name: string;
  art: string;
}

export const PRODUCT_ART: ProductArt[] = [
  { id: "origins", name: "Origins Booster Pack", art: "/art/packs/pack-origins.png" },
  { id: "proving-grounds", name: "Proving Grounds Starter Set", art: "/art/packs/pack-proving-grounds.png" },
  { id: "champ-jinx", name: "Jinx Champion Deck", art: "/art/packs/pack-champ-jinx.png" },
  { id: "champ-viktor", name: "Viktor Champion Deck", art: "/art/packs/pack-champ-viktor.png" },
  { id: "champ-leesin", name: "Lee Sin Champion Deck", art: "/art/packs/pack-champ-leesin.png" },
  { id: "domain", name: "Origins Domain Booster", art: "/art/packs/pack-domain.png" },
];
