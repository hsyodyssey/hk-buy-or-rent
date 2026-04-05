/**
 * Hierarchical region data for Hong Kong property districts.
 * Derived from private_data/hma.json — 2-level structure:
 *   L1: Major regions (港島, 九龍, 新界東, 新界西)
 *   L2: Sub-districts (e.g., 堅尼地城|西營盤, 大角咀|油麻地|旺角)
 *       Each sub-district contains its constituent HMA codes.
 */

import { DISTRICT_CODES } from "./districtCodes";

// ─── Types ──────────────────────────────────────────────────────

export interface HmaEntry {
  name: string;
  code: string; // e.g., "19-HMA111"
  districtIdx: number; // index into DISTRICTS[] array, -1 if not found
}

export interface SubDistrict {
  name: string; // e.g., "堅尼地城 | 西營盤"
  code: string; // e.g., "23-WS001"
  hmas: HmaEntry[];
  /** Index of the first HMA that exists in the model. -1 if none found. */
  primaryIdx: number;
}

export interface Region {
  name: string; // e.g., "港島"
  code: string; // e.g., "4-HK"
  subDistricts: SubDistrict[];
}

// ─── Raw hierarchy from hma.json ─────────────────────────────────

interface RawPlace {
  name: string;
  code: string;
  gMap?: { lat: number; lng: number };
  places?: RawPlace[];
}

// ─── Build region data ──────────────────────────────────────────

function buildSubDistrict(sd: RawPlace): SubDistrict {
  const hmas: HmaEntry[] = (sd.places ?? [])
    .filter((p) => p.code.startsWith("19-HMA"))
    .map((p) => ({
      name: p.name,
      code: p.code,
      districtIdx: DISTRICT_CODES.indexOf(p.code),
    }));

  const primaryIdx = hmas.find((h) => h.districtIdx >= 0)?.districtIdx ?? -1;

  return {
    name: sd.name,
    code: sd.code,
    hmas,
    primaryIdx,
  };
}

function buildRegion(region: RawPlace): Region {
  const subDistricts = (region.places ?? [])
    .filter((p) => p.code.startsWith("23-WS"))
    .map(buildSubDistrict);

  return {
    name: region.name,
    code: region.code,
    subDistricts,
  };
}

// The raw hierarchy data — directly embedded from hma.json structure
const RAW_REGIONS: RawPlace[] = [
  {
    name: "港島",
    code: "4-HK",
    places: [
      { name: "堅尼地城 | 西營盤", code: "23-WS001", places: [
        { name: "堅尼地城", code: "19-HMA111" },
        { name: "石塘咀", code: "19-HMA047" },
        { name: "西營盤", code: "19-HMA056" },
        { name: "上環", code: "19-HMA012" },
      ]},
      { name: "貝沙灣", code: "23-WS002", places: [
        { name: "貝沙灣", code: "19-HMA063" },
      ]},
      { name: "海怡", code: "23-WS003", places: [
        { name: "海怡", code: "19-HMA200" },
      ]},
      { name: "薄扶林 | 香港仔 | 鴨脷洲", code: "23-WS004", places: [
        { name: "薄扶林", code: "19-HMA155" },
        { name: "華富", code: "19-HMA127" },
        { name: "田灣", code: "19-HMA045" },
        { name: "香港仔", code: "19-HMA093" },
        { name: "鴨脷洲", code: "19-HMA151" },
        { name: "玉桂山灣畔", code: "19-HMA082" },
        { name: "深灣", code: "19-HMA122" },
      ]},
      { name: "黃竹坑", code: "23-WS056", places: [
        { name: "黃竹坑", code: "19-HMA132" },
      ]},
      { name: "西半山", code: "23-WS005", places: [
        { name: "中環", code: "19-HMA028" },
        { name: "西半山", code: "19-HMA053" },
      ]},
      { name: "山頂 | 南區", code: "23-WS006", places: [
        { name: "山頂", code: "19-HMA025" },
        { name: "壽臣山", code: "19-HMA141" },
        { name: "深水灣", code: "19-HMA121" },
        { name: "淺水灣", code: "19-HMA118" },
        { name: "舂坎角", code: "19-HMA123" },
        { name: "馬坑", code: "19-HMA105" },
        { name: "赤柱", code: "19-HMA064" },
        { name: "大潭", code: "19-HMA018" },
        { name: "石澳", code: "19-HMA048" },
      ]},
      { name: "中半山", code: "23-WS007", places: [
        { name: "金鐘", code: "19-HMA076" },
        { name: "中半山", code: "19-HMA026" },
      ]},
      { name: "東半山 | 跑馬地", code: "23-WS008", places: [
        { name: "跑馬地", code: "19-HMA130" },
        { name: "東半山", code: "19-HMA070" },
        { name: "大坑半山", code: "19-HMA071" },
        { name: "渣甸山", code: "19-HMA126" },
      ]},
      { name: "灣仔 | 銅鑼灣", code: "23-WS009", places: [
        { name: "灣仔", code: "19-HMA160" },
        { name: "銅鑼灣", code: "19-HMA144" },
      ]},
      { name: "北角", code: "23-WS010", places: [
        { name: "北角", code: "19-HMA041" },
        { name: "天后", code: "19-HMA032" },
        { name: "大坑", code: "19-HMA014" },
      ]},
      { name: "北角半山", code: "23-WS011", places: [
        { name: "北角半山", code: "19-HMA042" },
      ]},
      { name: "康怡 | 鰂魚涌", code: "23-WS012", places: [
        { name: "鰂魚涌", code: "19-HMA110" },
        { name: "康怡", code: "19-HMA113" },
      ]},
      { name: "太古城", code: "23-WS013", places: [
        { name: "太古城", code: "19-HMA034" },
      ]},
      { name: "西灣河", code: "23-WS014", places: [
        { name: "西灣河", code: "19-HMA057" },
        { name: "耀東", code: "19-HMA195" },
      ]},
      { name: "筲箕灣 | 柴灣", code: "23-WS015", places: [
        { name: "筲箕灣", code: "19-HMA163" },
        { name: "柴灣", code: "19-HMA094" },
        { name: "小西灣", code: "19-HMA020" },
      ]},
      { name: "杏花邨", code: "23-WS016", places: [
        { name: "杏花邨", code: "19-HMA061" },
      ]},
    ],
  },
  {
    name: "九龍",
    code: "4-KL",
    places: [
      { name: "大角咀 | 油麻地 | 旺角", code: "23-WS017", places: [
        { name: "油麻地", code: "19-HMA074" },
        { name: "旺角", code: "19-HMA068" },
        { name: "大角咀", code: "19-HMA015" },
        { name: "太子", code: "19-HMA033" },
      ]},
      { name: "奧運站", code: "23-WS018", places: [
        { name: "奧運站", code: "19-HMA134" },
      ]},
      { name: "九龍站", code: "23-WS019", places: [
        { name: "九龍站", code: "19-HMA003" },
      ]},
      { name: "尖沙咀 | 佐敦", code: "23-WS020", places: [
        { name: "尖沙咀", code: "19-HMA172" },
        { name: "尖沙咀東部", code: "19-HMA052" },
        { name: "佐敦", code: "19-HMA059" },
      ]},
      { name: "美孚 | 華景", code: "23-WS021", places: [
        { name: "華景", code: "19-HMA128" },
        { name: "荔灣", code: "19-HMA099" },
        { name: "荔景", code: "19-HMA098" },
        { name: "美孚", code: "19-HMA092" },
        { name: "盈暉", code: "19-HMA089" },
      ]},
      { name: "荔枝角", code: "23-WS022", places: [
        { name: "四小龍", code: "19-HMA043" },
      ]},
      { name: "南昌站", code: "23-WS023", places: [
        { name: "南昌站", code: "19-HMA081" },
      ]},
      { name: "長沙灣 | 深水埗", code: "23-WS024", places: [
        { name: "深水埗", code: "19-HMA171" },
        { name: "石硤尾", code: "19-HMA049" },
        { name: "長沙灣", code: "19-HMA077" },
      ]},
      { name: "又一村", code: "23-WS025", places: [
        { name: "又一村", code: "19-HMA010" },
      ]},
      { name: "九龍塘", code: "23-WS026", places: [
        { name: "九龍塘", code: "19-HMA004" },
        { name: "龍坪", code: "19-HMA152" },
      ]},
      { name: "何文田 | 京士柏", code: "23-WS027", places: [
        { name: "京士柏", code: "19-HMA065" },
        { name: "何文田", code: "19-HMA058" },
      ]},
      { name: "紅磡", code: "23-WS028", places: [
        { name: "紅磡", code: "19-HMA090" },
        { name: "紅磡站", code: "19-HMA091" },
      ]},
      { name: "黃埔 | 海逸", code: "23-WS029", places: [
        { name: "黃埔", code: "19-HMA133" },
        { name: "海逸", code: "19-HMA095" },
      ]},
      { name: "啟德新區", code: "23-WS030", places: [
        { name: "啟德新區", code: "19-HMA117" },
      ]},
      { name: "土瓜灣", code: "23-WS031", places: [
        { name: "土瓜灣", code: "19-HMA013" },
        { name: "馬頭圍", code: "19-HMA108" },
      ]},
      { name: "鑽石山 | 黃大仙", code: "23-WS032", places: [
        { name: "樂富", code: "19-HMA147" },
        { name: "坪石", code: "19-HMA066" },
        { name: "黃大仙", code: "19-HMA131" },
        { name: "慈雲山", code: "19-HMA135" },
        { name: "新蒲崗", code: "19-HMA137" },
        { name: "鑽石山", code: "19-HMA162" },
        { name: "九龍城", code: "19-HMA002" },
        { name: "彩虹", code: "19-HMA115" },
        { name: "牛池灣", code: "19-HMA039" },
      ]},
      { name: "九龍灣", code: "23-WS033", places: [
        { name: "九龍灣", code: "19-HMA005" },
        { name: "牛頭角", code: "19-HMA040" },
      ]},
      { name: "觀塘", code: "23-WS034", places: [
        { name: "觀塘", code: "19-HMA161" },
        { name: "安達臣", code: "19-HMA051" },
      ]},
      { name: "藍田 | 油塘", code: "23-WS035", places: [
        { name: "藍田", code: "19-HMA156" },
        { name: "油塘", code: "19-HMA075" },
      ]},
      { name: "將軍澳", code: "23-WS036", places: [
        { name: "調景嶺", code: "19-HMA148" },
        { name: "將軍澳", code: "19-HMA112" },
        { name: "坑口", code: "19-HMA060" },
        { name: "寶琳", code: "19-HMA159" },
        { name: "康城", code: "19-HMA114" },
      ]},
    ],
  },
  {
    name: "新界東",
    code: "4-NE",
    places: [
      { name: "上水 | 粉嶺 | 古洞", code: "23-WS037", places: [
        { name: "粉嶺", code: "19-HMA179" },
        { name: "上水", code: "19-HMA168" },
        { name: "古洞", code: "19-HMA166" },
        { name: "皇后山", code: "19-HMA165" },
        { name: "打鼓嶺", code: "19-HMA164" },
        { name: "沙頭角", code: "19-HMA189" },
      ]},
      { name: "大埔", code: "23-WS039", places: [
        { name: "白石角", code: "19-HMA207" },
        { name: "康樂園", code: "19-HMA180" },
        { name: "大埔豪宅 | 半山", code: "19-HMA999" },
        { name: "大埔市中心", code: "19-HMA185" },
        { name: "大埔墟", code: "19-HMA184" },
        { name: "大埔村屋", code: "19-HMA998" },
      ]},
      { name: "火炭 | 九肚山", code: "23-WS040", places: [
        { name: "火炭", code: "19-HMA187" },
        { name: "九肚山", code: "19-HMA001" },
      ]},
      { name: "沙田", code: "23-WS041", places: [
        { name: "沙田", code: "19-HMA170" },
        { name: "沙田第一城", code: "19-HMA062" },
        { name: "石門", code: "19-HMA176" },
        { name: "小瀝源", code: "19-HMA021" },
        { name: "馬料水", code: "19-HMA106" },
      ]},
      { name: "大圍", code: "23-WS042", places: [
        { name: "大圍", code: "19-HMA188" },
      ]},
      { name: "馬鞍山", code: "23-WS043", places: [
        { name: "馬鞍山", code: "19-HMA107" },
        { name: "烏溪沙", code: "19-HMA996" },
        { name: "恆安", code: "19-HMA994" },
        { name: "大水坑", code: "19-HMA995" },
      ]},
      { name: "西貢", code: "23-WS044", places: [
        { name: "西貢市中心", code: "19-HMA055" },
        { name: "白沙灣", code: "19-HMA046" },
        { name: "西沙", code: "19-HMA054" },
        { name: "清水灣", code: "19-HMA119" },
        { name: "大網仔", code: "19-HMA017" },
      ]},
    ],
  },
  {
    name: "新界西",
    code: "4-NW",
    places: [
      { name: "錦繡 | 加州 | 葡萄園", code: "23-WS045", places: [
        { name: "加州 | 錦繡", code: "19-HMA150" },
        { name: "牛潭尾", code: "19-HMA136" },
      ]},
      { name: "屯門", code: "23-WS046", places: [
        { name: "洪水橋北新發展", code: "19-HMA085" },
        { name: "屯門新墟", code: "19-HMA138" },
        { name: "置樂", code: "19-HMA139" },
        { name: "屯門市中心", code: "19-HMA037" },
        { name: "屯門碼頭", code: "19-HMA038" },
        { name: "龍鼓灘", code: "19-HMA153" },
        { name: "屯門南", code: "19-HMA036" },
        { name: "屯門北", code: "19-HMA035" },
        { name: "兆康", code: "19-HMA050" },
        { name: "藍地", code: "19-HMA157" },
        { name: "洪水橋南新發展", code: "19-HMA086" },
      ]},
      { name: "天水圍", code: "23-WS047", places: [
        { name: "天水圍", code: "19-HMA031" },
      ]},
      { name: "元朗", code: "23-WS048", places: [
        { name: "屏山", code: "19-HMA084" },
        { name: "元朗南新發展", code: "19-HMA191" },
        { name: "流浮山", code: "19-HMA087" },
        { name: "橫洲", code: "19-HMA083" },
        { name: "朗屏", code: "19-HMA190" },
        { name: "元朗站", code: "19-HMA030" },
        { name: "元朗市中心", code: "19-HMA029" },
        { name: "十八鄉", code: "19-HMA009" },
        { name: "元朗東南", code: "19-HMA008" },
        { name: "八鄉南", code: "19-HMA007" },
        { name: "八鄉北", code: "19-HMA006" },
        { name: "錦田", code: "19-HMA149" },
      ]},
      { name: "深井 | 青山公路", code: "23-WS049", places: [
        { name: "小欖", code: "19-HMA023" },
        { name: "掃管笏", code: "19-HMA116" },
        { name: "三聖", code: "19-HMA011" },
        { name: "油柑頭 | 汀九", code: "19-HMA073" },
        { name: "深井", code: "19-HMA120" },
        { name: "青龍頭", code: "19-HMA080" },
      ]},
      { name: "荃灣 | 麗城", code: "23-WS050", places: [
        { name: "大窩口", code: "19-HMA016" },
        { name: "綠楊", code: "19-HMA143" },
        { name: "荃灣海濱", code: "19-HMA103" },
        { name: "荃灣市中心", code: "19-HMA104" },
        { name: "愉景新城", code: "19-HMA193" },
        { name: "荃景圍", code: "19-HMA100" },
        { name: "荃灣半山", code: "19-HMA101" },
        { name: "荃灣西", code: "19-HMA102" },
        { name: "麗城", code: "19-HMA158" },
      ]},
      { name: "葵涌", code: "23-WS051", places: [
        { name: "上葵涌", code: "19-HMA140" },
        { name: "下葵涌", code: "19-HMA192" },
      ]},
      { name: "青衣", code: "23-WS052", places: [
        { name: "青衣", code: "19-HMA079" },
      ]},
      { name: "馬灣 | 珀麗灣", code: "23-WS053", places: [
        { name: "馬灣", code: "19-HMA109" },
      ]},
      { name: "東涌", code: "23-WS054", places: [
        { name: "東涌市中心", code: "19-HMA174" },
        { name: "東涌北", code: "19-HMA183" },
      ]},
      { name: "愉景灣 | 離島", code: "23-WS055", places: [
        { name: "愉景灣", code: "19-HMA125" },
        { name: "大嶼山", code: "19-HMA019" },
        { name: "長洲", code: "19-HMA078" },
        { name: "坪洲及喜靈洲", code: "19-HMA067" },
        { name: "南丫及蒲台", code: "19-HMA178" },
      ]},
    ],
  },
];

// ─── Exported data ──────────────────────────────────────────────

export const REGIONS: Region[] = RAW_REGIONS.map(buildRegion);
