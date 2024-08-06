/**
 * 最大なぞり数に対して、各セルインデックス始まりのなぞり候補が、
 * [なぞり制限](https://github.com/pikumist/puyomist/wiki/なぞり方#なぞりの制限)をかけた上で、
 * 何個あるか。候補数は、packages/solver-wasm/src/main.rs から計算。
 */
const traceCandidatesNumMap: Map<number, number[]> = new Map([
  [
    1,
    // total: 48
    [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ].flat()
  ],
  [
    2,
    // total: 200
    [
      [4, 5, 5, 5, 5, 5, 5, 3],
      [4, 5, 5, 5, 5, 5, 5, 3],
      [4, 5, 5, 5, 5, 5, 5, 3],
      [4, 5, 5, 5, 5, 5, 5, 3],
      [4, 5, 5, 5, 5, 5, 5, 3],
      [2, 2, 2, 2, 2, 2, 2, 1]
    ].flat()
  ],
  [
    3,
    // total: 804
    [
      [16, 23, 25, 25, 25, 25, 20, 10],
      [16, 23, 25, 25, 25, 25, 20, 10],
      [16, 23, 25, 25, 25, 25, 20, 10],
      [16, 23, 25, 25, 25, 25, 20, 10],
      [11, 15, 16, 16, 16, 16, 12, 5],
      [3, 3, 3, 3, 3, 3, 2, 1]
    ].flat()
  ],
  [
    4,
    // total: 3435
    [
      [72, 111, 130, 135, 135, 122, 86, 40],
      [72, 111, 130, 135, 135, 122, 86, 40],
      [72, 111, 130, 135, 135, 122, 86, 40],
      [59, 89, 104, 108, 108, 96, 64, 27],
      [28, 39, 43, 44, 44, 36, 20, 7],
      [4, 4, 4, 4, 4, 3, 2, 1]
    ].flat()
  ],
  [
    5,
    // total: 15359
    [
      [354, 569, 701, 760, 738, 614, 407, 184],
      [354, 569, 701, 760, 738, 614, 407, 184],
      [319, 508, 626, 680, 658, 539, 346, 149],
      [208, 318, 385, 417, 396, 303, 174, 68],
      [69, 97, 108, 112, 97, 61, 28, 9],
      [5, 5, 5, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    6,
    // total: 70147
    [
      [1851, 3061, 3904, 4289, 4055, 3229, 2076, 924],
      [1755, 2890, 3688, 4054, 3820, 3013, 1905, 828],
      [1371, 2211, 2804, 3072, 2843, 2148, 1279, 527],
      [721, 1106, 1356, 1435, 1240, 836, 440, 167],
      [168, 237, 265, 244, 168, 87, 36, 11],
      [6, 6, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    7,
    // total: 320111
    [
      [9847, 16597, 21442, 23435, 21748, 16951, 10677, 4646],
      [8552, 14258, 18349, 19965, 18297, 13922, 8493, 3583],
      [5788, 9371, 11816, 12535, 11005, 7879, 4517, 1828],
      [2487, 3818, 4529, 4368, 3371, 2108, 1082, 406],
      [407, 575, 580, 432, 243, 112, 44, 13],
      [7, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    8,
    // total: 1438335
    [
      [52074, 88048, 112982, 121696, 111258, 85638, 53256, 22811],
      [41010, 68042, 85982, 90925, 80991, 60318, 36291, 15160],
      [24261, 38698, 46767, 46606, 38715, 27011, 15503, 6306],
      [8568, 12748, 13813, 11738, 8167, 4923, 2568, 983],
      [984, 1263, 1047, 636, 312, 134, 51, 15],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    9,
    // total: 6300691
    [
      [270217, 450891, 566341, 596944, 537525, 410843, 254995, 109053],
      [192844, 312242, 379459, 384961, 333055, 245923, 149089, 62960],
      [99883, 152682, 171883, 158646, 125131, 86581, 50940, 21317],
      [28524, 39001, 37221, 27897, 17893, 10530, 5606, 2248],
      [2121, 2273, 1544, 808, 364, 149, 55, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    10,
    // total: 26702013
    [
      [1361866, 2214164, 2694775, 2762946, 2447637, 1866489, 1167920, 505087],
      [877823, 1363818, 1572106, 1519409, 1277658, 942682, 583182, 252566],
      [392281, 560002, 578541, 494037, 372115, 256405, 155062, 67526],
      [86062, 104084, 86793, 58366, 35107, 20023, 10624, 4395],
      [3692, 3285, 1917, 914, 391, 155, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    11,
    // total: 108735877
    // biome-ignore format:
    [
      [6603026, 10368815, 12145234, 12063087, 10505075, 8016196, 5087335, 2241642],
      [3800923, 5598294, 6077424, 5584301, 4568233, 3373511, 2134104, 952284],
      [1420203, 1862680, 1759399, 1397212, 1008879, 687723, 422138, 190147],
      [223067, 235523, 173112, 106343, 60331, 32894, 16914, 6978],
      [5155, 3967, 2108, 957, 399, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    12,
    // total: 422742049
    // biome-ignore format:
    [
      [30518511, 46020018, 51669075, 49604757, 42436829, 32418324, 20890992, 9399218],
      [15385608, 21328670, 21753970, 19014294, 15129263, 11142539, 7165949, 3282884],
      [4612292, 5518317, 4775540, 3547850, 2455850, 1636077, 1000386, 458591],
      [484502, 447872, 294516, 167464, 89619, 46300, 22708, 9123],
      [6068, 4271, 2171, 967, 400, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    13,
    // total: 1559392541
    // biome-ignore format:
    [
      [133305271, 192318680, 206545464, 191459941, 160723600, 122673251, 80064450, 36714279],
      [57400428, 74623469, 71509503, 59515425, 45974191, 33533727, 21710520, 10130610],
      [13208985, 14392161, 11455573, 7994919, 5288574, 3399724, 2034148, 932375],
      [879916, 719785, 430523, 228920, 115835, 56771, 26566, 10340],
      [6445, 4357, 2183, 968, 400, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    14,
    // total: 5425777501
    // biome-ignore format:
    [
      [546127944, 752059376, 771799315, 690172762, 567386521, 431073276, 283596903, 132023898],
      [195329431, 237736479, 214158296, 169773022, 126897533, 90892973, 58608271, 27601147],
      [33060003, 32824890, 24125526, 15853144, 9980577, 6130505, 3541414, 1599702],
      [1352378, 994365, 550606, 276878, 133629, 62808, 28395, 10803],
      [6544, 4371, 2184, 968, 400, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    15,
    // total: 17710655729
    // biome-ignore format:
    [
      [2085252830, 2736517468, 2681276145, 2310201432, 1854675416, 1395956357, 920573664, 433065911],
      [601777357, 684919982, 580125374, 437840095, 315379530, 219951704, 139838948, 65884894],
      [72066452, 65310625, 44497061, 27571434, 16474165, 9617654, 5322634, 2346744],
      [1797827, 1212305, 633465, 305588, 142673, 65335, 28997, 10916],
      [6559, 4372, 2184, 968, 400, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    16,
    // total: 53964309390
    // biome-ignore format:
    [
      [7381538888, 9217671295, 8613308637, 7138221829, 5577586220, 4137241199, 2719277765, 1286697340],
      [1669307617, 1774497661, 1412854990, 1014305601, 701303982, 472684231, 293734185, 137377078],
      [136924429, 113565188, 72053389, 42189465, 23924312, 13270237, 7023587, 3010133],
      [2128839, 1347894, 677810, 318635, 146063, 66083, 29128, 10932],
      [6560, 4372, 2184, 968, 400, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    17,
    // total: 152785608286
    // biome-ignore format:
    [
      [24111922458, 28601411889, 25450109307, 20247335087, 15344078590, 11157230451, 7268132766, 3443805279],
      [4152309813, 4116504025, 3080002623, 2101778986, 1390521391, 900528922, 543124421, 250489618],
      [227793268, 173698623, 103257501, 57362510, 30978308, 16398525, 8333915, 3476734],
      [2322342, 1413778, 696052, 323070, 146976, 66232, 29145, 10933],
      [6560, 4372, 2184, 968, 400, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ],
  [
    18,
    // total: 400246781472
    // biome-ignore format:
    [
      [72363180410, 81365137389, 68823825972, 52464287860, 38435265721, 27255987276, 17502202202, 8268813839],
      [9236021931, 8527856993, 5997054290, 3889556563, 2457614788, 1523647150, 887389434, 401491892],
      [334754699, 236411742, 132761468, 70431256, 36477150, 18584662, 9146909, 3736121],
      [2411021, 1438610, 701735, 324168, 147144, 66250, 29146, 10933],
      [6560, 4372, 2184, 968, 400, 156, 56, 16],
      [8, 7, 6, 5, 4, 3, 2, 1]
    ].flat()
  ]
]);
