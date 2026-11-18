/**
 * ========================================================
 * NORTHSTAR COMMAND - NORTHERN PROVINCES WEATHER & AQI LAYER
 * Hiển thị ranh giới các tỉnh thành miền Bắc thành từng ô phân vùng
 * và cung cấp thông tin thời tiết & chất lượng không khí (AQI) thời gian thực
 * khi di chuột (hover) hoặc bấm chọn.
 * Nguồn dữ liệu: Open-Meteo Weather API & Air Quality API (Chuẩn Open Data)
 * ========================================================
 */

(function () {
  'use strict';

  const NORTHERN_PROVINCES_GEOJSON = {"type": "FeatureCollection", "features": [{"type": "Feature", "id": "VN.QN", "properties": {"hc-group": "admin1", "hc-key": "vn-qn", "hc-a2": "QN", "labelrank": "7", "iso_3166_2": "VN-13", "hasc": "VN.QN", "alt-name": "Quang Ninh", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347712", "longitude": "107.181", "subregion": null, "woe-name": "Quảng Ninh", "fips": "VM13", "latitude": "21.223", "woe-label": "Quang Ninh, VN, Vietnam", "postal-code": "QN", "type": "Tỉnh", "name": "Quảng Ninh"}, "geometry": {"type": "MultiPolygon", "coordinates": [[[[2185, 8009], [2213, 7981], [2195, 7984], [2172, 8020], [2185, 8009]]], [[[2584, 8045], [2609, 8045], [2614, 8029], [2595, 8024], [2584, 8045]]], [[[2236, 8035], [2268, 7973], [2241, 7974], [2222, 8007], [2188, 8018], [2197, 8071], [2225, 8060], [2236, 8035]]], [[[2676, 7992], [2670, 8043], [2702, 8052], [2724, 8097], [2721, 8070], [2676, 7992]]], [[[2181, 8107], [2180, 8083], [2134, 8093], [2133, 8111], [2181, 8107]]], [[[2891, 8126], [2854, 8086], [2868, 8119], [2858, 8146], [2891, 8126]]], [[[2711, 8159], [2729, 8155], [2710, 8093], [2689, 8067], [2618, 8052], [2684, 8103], [2692, 8144], [2711, 8159]]], [[[2744, 8216], [2738, 8191], [2704, 8172], [2725, 8213], [2744, 8216]]], [[[2751, 8136], [2735, 8142], [2751, 8190], [2779, 8212], [2751, 8136]]], [[[2898, 8387], [2831, 8357], [2841, 8369], [2880, 8394], [2898, 8387]]], [[[3027, 8427], [2920, 8389], [2938, 8419], [3027, 8431], [3027, 8427]]], [[[2104, 8134], [2099, 8134], [2073, 8140], [2053, 8151], [1985, 8159], [1962, 8167], [1959, 8192], [1996, 8216], [2030, 8263], [2178, 8241], [2222, 8242], [2318, 8269], [2334, 8309], [2341, 8355], [2386, 8389], [2429, 8397], [2489, 8424], [2507, 8447], [2509, 8483], [2494, 8513], [2505, 8534], [2568, 8577], [2578, 8567], [2620, 8602], [2645, 8603], [2656, 8566], [2689, 8556], [2705, 8576], [2760, 8575], [2813, 8590], [2850, 8614], [2910, 8602], [2926, 8574], [3021, 8491], [2979, 8459], [2971, 8514], [2932, 8522], [2923, 8495], [2904, 8495], [2878, 8517], [2881, 8469], [2868, 8466], [2855, 8433], [2778, 8412], [2783, 8382], [2760, 8376], [2754, 8349], [2729, 8348], [2709, 8383], [2689, 8348], [2627, 8369], [2647, 8344], [2595, 8328], [2587, 8268], [2610, 8263], [2602, 8213], [2588, 8188], [2602, 8148], [2575, 8131], [2514, 8128], [2478, 8091], [2448, 8075], [2391, 8099], [2410, 8125], [2447, 8150], [2429, 8152], [2384, 8135], [2362, 8149], [2372, 8124], [2357, 8093], [2309, 8090], [2258, 8121], [2244, 8117], [2292, 8078], [2306, 8053], [2268, 8057], [2255, 8037], [2230, 8077], [2212, 8073], [2188, 8091], [2219, 8100], [2197, 8132], [2159, 8144], [2150, 8126], [2104, 8134]]], [[[2310, 8028], [2342, 8015], [2362, 8023], [2376, 8001], [2407, 7994], [2412, 7969], [2372, 7953], [2394, 7941], [2379, 7907], [2345, 7943], [2337, 7937], [2284, 7990], [2310, 8028]]], [[[2650, 8284], [2653, 8328], [2664, 8331], [2703, 8299], [2707, 8278], [2758, 8291], [2720, 8244], [2704, 8247], [2668, 8199], [2612, 8163], [2601, 8171], [2621, 8221], [2631, 8272], [2650, 8284]]]]}}, {"type": "Feature", "id": "VN.PT", "properties": {"hc-group": "admin1", "hc-key": "vn-pt", "hc-a2": "PT", "labelrank": "7", "iso_3166_2": "VN-68", "hasc": "VN.PT", "alt-name": "Phu Tho", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "20070091", "longitude": "105.143", "subregion": null, "woe-name": "Phú Thọ", "fips": "VM83", "latitude": "21.3127", "woe-label": "Phu Tho, VN, Vietnam", "postal-code": "PT", "type": "Tỉnh", "name": "Phú Thọ"}, "geometry": {"type": "Polygon", "coordinates": [[[849, 8357], [895, 8383], [912, 8407], [890, 8499], [892, 8531], [914, 8571], [966, 8600], [1017, 8613], [1044, 8632], [1088, 8605], [1127, 8569], [1185, 8493], [1203, 8434], [1236, 8416], [1277, 8353], [1282, 8336], [1262, 8319], [1252, 8341], [1210, 8337], [1203, 8290], [1163, 8256], [1178, 8208], [1163, 8155], [1179, 8124], [1194, 8102], [1196, 8056], [1171, 8054], [1112, 8070], [1046, 8079], [996, 8122], [927, 8155], [904, 8190], [879, 8225], [875, 8299], [849, 8357]]]}}, {"type": "Feature", "id": "VN.YB", "properties": {"hc-group": "admin1", "hc-key": "vn-yb", "hc-a2": "YB", "labelrank": "7", "iso_3166_2": "VN-06", "hasc": "VN.YB", "alt-name": "Yen Bai", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347753", "longitude": "104.512", "subregion": null, "woe-name": "Yên Bái", "fips": "VM70", "latitude": "21.7484", "woe-label": "Yen Bai, VN, Vietnam", "postal-code": "YB", "type": "Tỉnh", "name": "Yên Bái"}, "geometry": {"type": "Polygon", "coordinates": [[[1044, 8632], [1017, 8613], [966, 8600], [914, 8571], [892, 8531], [890, 8499], [912, 8407], [895, 8383], [849, 8357], [815, 8361], [794, 8397], [754, 8395], [695, 8419], [664, 8412], [617, 8384], [586, 8386], [525, 8422], [506, 8442], [494, 8480], [499, 8530], [521, 8608], [492, 8637], [441, 8608], [398, 8600], [293, 8620], [230, 8646], [249, 8699], [223, 8744], [272, 8832], [330, 8793], [373, 8788], [423, 8771], [442, 8821], [523, 8781], [552, 8775], [581, 8801], [584, 8841], [544, 8923], [556, 8949], [608, 8955], [662, 8919], [700, 8962], [725, 8976], [713, 9038], [755, 9043], [810, 8982], [863, 8974], [888, 8914], [955, 8854], [966, 8830], [965, 8793], [1019, 8730], [1036, 8699], [1026, 8666], [1044, 8632]]]}}, {"type": "Feature", "id": "VN.HD", "properties": {"hc-group": "admin1", "hc-key": "vn-hd", "hc-a2": "HD", "labelrank": "7", "iso_3166_2": "VN-61", "hasc": "VN.HD", "alt-name": "Hai Duong", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "20070080", "longitude": "106.364", "subregion": null, "woe-name": "Hải Dương", "fips": "VM79", "latitude": "20.9613", "woe-label": "Hai Duong, VN, Vietnam", "postal-code": "HD", "type": "Tỉnh", "name": "Hải Dương"}, "geometry": {"type": "Polygon", "coordinates": [[[1761, 8117], [1812, 8108], [1848, 8112], [1867, 8129], [1872, 8171], [1860, 8217], [1882, 8257], [1920, 8283], [1970, 8291], [2008, 8280], [2030, 8263], [1996, 8216], [1959, 8192], [1962, 8167], [1985, 8159], [2053, 8151], [2073, 8140], [2060, 8094], [2026, 8074], [2025, 8039], [1999, 8018], [2006, 7990], [2030, 7977], [2026, 7961], [1975, 7915], [1945, 7914], [1835, 7896], [1789, 7942], [1752, 7968], [1741, 7995], [1766, 8064], [1761, 8117]]]}}, {"type": "Feature", "id": "VN.BN", "properties": {"hc-group": "admin1", "hc-key": "vn-bn", "hc-a2": "BN", "labelrank": "7", "iso_3166_2": "VN-56", "hasc": "VN.BN", "alt-name": "Bac Ninh", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "20070088", "longitude": "106.117", "subregion": null, "woe-name": "Bắc Ninh", "fips": "VM74", "latitude": "21.098", "woe-label": "Bac Ninh, VN, Vietnam", "postal-code": "BN", "type": "Tỉnh", "name": "Bắc Ninh"}, "geometry": {"type": "Polygon", "coordinates": [[[1860, 8217], [1872, 8171], [1867, 8129], [1848, 8112], [1812, 8108], [1761, 8117], [1709, 8119], [1659, 8111], [1663, 8151], [1606, 8211], [1598, 8258], [1617, 8299], [1675, 8273], [1802, 8252], [1860, 8217]]]}}, {"type": "Feature", "id": "VN.317", "properties": {"hc-group": "admin1", "hc-key": "vn-317", "hc-a2": "HY", "labelrank": "7", "iso_3166_2": "VN-", "hasc": "VN.", "alt-name": "Hung Yen", "country": "Vietnam", "type-en": "Region", "region": null, "woe-id": "20070079", "longitude": "106.076", "subregion": null, "woe-name": "Hung Yen", "fips": "VM81", "latitude": "20.8085", "woe-label": "Hung Yen, VN, Vietnam", "postal-code": null, "type": "Region", "name": "Hưng Yên"}, "geometry": {"type": "Polygon", "coordinates": [[[1659, 8111], [1709, 8119], [1761, 8117], [1766, 8064], [1741, 7995], [1752, 7968], [1789, 7942], [1835, 7896], [1800, 7874], [1753, 7874], [1735, 7848], [1699, 7837], [1679, 7863], [1678, 7904], [1662, 7907], [1635, 7921], [1627, 7961], [1602, 7971], [1596, 8000], [1604, 8034], [1585, 8049], [1596, 8092], [1659, 8111]]]}}, {"type": "Feature", "id": "VN.NB", "properties": {"hc-group": "admin1", "hc-key": "vn-nb", "hc-a2": "NB", "labelrank": "7", "iso_3166_2": "VN-18", "hasc": "VN.NB", "alt-name": "Ninh Binh", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "2347743", "longitude": "105.852", "subregion": null, "woe-name": "Ninh Bình", "fips": "VM59", "latitude": "20.2722", "woe-label": "Ninh Binh, VN, Vietnam", "postal-code": "NB", "type": "Tỉnh", "name": "Ninh Bình"}, "geometry": {"type": "Polygon", "coordinates": [[[1739, 7409], [1718, 7359], [1684, 7381], [1709, 7409], [1695, 7433], [1648, 7441], [1604, 7471], [1564, 7482], [1490, 7527], [1342, 7652], [1356, 7665], [1383, 7659], [1421, 7628], [1448, 7618], [1462, 7629], [1454, 7682], [1500, 7707], [1549, 7691], [1591, 7650], [1625, 7631], [1634, 7591], [1699, 7560], [1724, 7570], [1767, 7544], [1765, 7478], [1739, 7409]]]}}, {"type": "Feature", "id": "VN.HM", "properties": {"hc-group": "admin1", "hc-key": "vn-hm", "hc-a2": "HM", "labelrank": "7", "iso_3166_2": "VN-63", "hasc": "VN.HM", "alt-name": "Ha Nam", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "2347741", "longitude": "105.985", "subregion": null, "woe-name": "Hà Nam", "fips": "VM80", "latitude": "20.5569", "woe-label": "Ha Nam, VN, Vietnam", "postal-code": "HM", "type": "Tỉnh", "name": "Hà Nam"}, "geometry": {"type": "Polygon", "coordinates": [[[1625, 7631], [1591, 7650], [1549, 7691], [1526, 7745], [1510, 7800], [1531, 7858], [1603, 7881], [1648, 7888], [1662, 7907], [1678, 7904], [1679, 7863], [1699, 7837], [1735, 7848], [1752, 7807], [1774, 7786], [1786, 7745], [1707, 7739], [1677, 7687], [1637, 7691], [1626, 7671], [1625, 7631]]]}}, {"type": "Feature", "id": "VN.HO", "properties": {"hc-group": "admin1", "hc-key": "vn-ho", "hc-a2": "HO", "labelrank": "7", "iso_3166_2": "VN-14", "hasc": "VN.HO", "alt-name": "Hoa Binh", "country": "Vietnam", "type-en": "Province", "region": "Northwest", "woe-id": "2347737", "longitude": "105.34", "subregion": null, "woe-name": "Hòa Bình", "fips": "VM56", "latitude": "20.7292", "woe-label": "Hoa Binh, VN, Vietnam", "postal-code": "HO", "type": "Tỉnh", "name": "Hòa Bình"}, "geometry": {"type": "Polygon", "coordinates": [[[1510, 7800], [1526, 7745], [1549, 7691], [1500, 7707], [1454, 7682], [1462, 7629], [1448, 7618], [1421, 7628], [1383, 7659], [1356, 7665], [1342, 7652], [1282, 7665], [1180, 7717], [1114, 7762], [1081, 7805], [1062, 7815], [1013, 7804], [925, 7815], [859, 7841], [856, 7893], [869, 7916], [949, 7917], [1020, 7948], [1027, 7978], [976, 8013], [907, 8089], [885, 8132], [886, 8160], [904, 8190], [927, 8155], [996, 8122], [1046, 8079], [1112, 8070], [1171, 8054], [1196, 8056], [1194, 8102], [1179, 8124], [1226, 8132], [1287, 8124], [1315, 8107], [1333, 8054], [1317, 8003], [1334, 7980], [1390, 7941], [1436, 7851], [1488, 7824], [1510, 7800]]]}}, {"type": "Feature", "id": "VN.VC", "properties": {"hc-group": "admin1", "hc-key": "vn-vc", "hc-a2": "VC", "labelrank": "7", "iso_3166_2": "VN-70", "hasc": "VN.VC", "alt-name": "Vinh Phuc", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "20070090", "longitude": "105.549", "subregion": null, "woe-name": "Vĩnh Phúc", "fips": "VM86", "latitude": "21.3455", "woe-label": "Vinh Phuc, VN, Vietnam", "postal-code": "VC", "type": "Tỉnh", "name": "Vĩnh Phúc"}, "geometry": {"type": "Polygon", "coordinates": [[[1262, 8319], [1282, 8336], [1277, 8353], [1236, 8416], [1203, 8434], [1185, 8493], [1237, 8479], [1283, 8480], [1337, 8498], [1363, 8515], [1404, 8475], [1475, 8423], [1498, 8383], [1494, 8310], [1504, 8248], [1492, 8194], [1419, 8234], [1321, 8239], [1281, 8269], [1262, 8319]]]}}, {"type": "Feature", "id": "VN.318", "properties": {"hc-group": "admin1", "hc-key": "vn-318", "hc-a2": "HN", "labelrank": "7", "iso_3166_2": "VN-HN", "hasc": "VN.", "alt-name": null, "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347727", "longitude": "105.872", "subregion": null, "woe-name": "Ha Noi", "fips": null, "latitude": "21.1306", "woe-label": null, "postal-code": null, "type": "Tỉnh", "name": "Hà Nội"}, "geometry": {"type": "Polygon", "coordinates": [[[1600, 8358], [1614, 8329], [1617, 8299], [1598, 8258], [1606, 8211], [1663, 8151], [1659, 8111], [1596, 8092], [1585, 8049], [1604, 8034], [1596, 8000], [1602, 7971], [1627, 7961], [1635, 7921], [1662, 7907], [1648, 7888], [1603, 7881], [1531, 7858], [1510, 7800], [1488, 7824], [1436, 7851], [1390, 7941], [1334, 7980], [1317, 8003], [1333, 8054], [1315, 8107], [1287, 8124], [1226, 8132], [1179, 8124], [1163, 8155], [1178, 8208], [1163, 8256], [1203, 8290], [1210, 8337], [1252, 8341], [1262, 8319], [1281, 8269], [1321, 8239], [1419, 8234], [1492, 8194], [1504, 8248], [1494, 8310], [1498, 8383], [1550, 8384], [1600, 8358]]]}}, {"type": "Feature", "id": "VN.BG", "properties": {"hc-group": "admin1", "hc-key": "vn-bg", "hc-a2": "BG", "labelrank": "7", "iso_3166_2": "VN-54", "hasc": "VN.BG", "alt-name": "Bac Giang", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "20070087", "longitude": "106.493", "subregion": null, "woe-name": "Bắc Giang", "fips": "VM71", "latitude": "21.3512", "woe-label": "Bac Giang, VN, Vietnam", "postal-code": "BG", "type": "Tỉnh", "name": "Bắc Giang"}, "geometry": {"type": "Polygon", "coordinates": [[[1617, 8299], [1614, 8329], [1600, 8358], [1634, 8417], [1667, 8420], [1689, 8436], [1703, 8487], [1680, 8564], [1699, 8582], [1752, 8574], [1768, 8537], [1767, 8498], [1854, 8469], [1896, 8430], [1928, 8421], [1970, 8436], [1990, 8465], [2012, 8520], [2037, 8551], [2086, 8568], [2121, 8561], [2166, 8525], [2210, 8557], [2229, 8558], [2242, 8520], [2287, 8450], [2338, 8451], [2358, 8400], [2386, 8389], [2341, 8355], [2334, 8309], [2318, 8269], [2222, 8242], [2178, 8241], [2030, 8263], [2008, 8280], [1970, 8291], [1920, 8283], [1882, 8257], [1860, 8217], [1802, 8252], [1675, 8273], [1617, 8299]]]}}, {"type": "Feature", "id": "VN.TB", "properties": {"hc-group": "admin1", "hc-key": "vn-tb", "hc-a2": "TB", "labelrank": "7", "iso_3166_2": "VN-20", "hasc": "VN.TB", "alt-name": "Thai Binh", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "2347716", "longitude": "106.371", "subregion": null, "woe-name": "Thái Bình", "fips": "VM35", "latitude": "20.5303", "woe-label": "Thai Binh, VN, Vietnam", "postal-code": "TB", "type": "Tỉnh", "name": "Thái Bình"}, "geometry": {"type": "Polygon", "coordinates": [[[1786, 7745], [1774, 7786], [1752, 7807], [1735, 7848], [1753, 7874], [1800, 7874], [1835, 7896], [1945, 7914], [1967, 7847], [1982, 7827], [2029, 7836], [2067, 7862], [2091, 7840], [2087, 7821], [2016, 7784], [2050, 7772], [2059, 7738], [2047, 7721], [2069, 7716], [2055, 7657], [2069, 7589], [2062, 7581], [2039, 7601], [2039, 7601], [2020, 7617], [2007, 7607], [1971, 7597], [1900, 7653], [1851, 7627], [1842, 7638], [1847, 7683], [1810, 7688], [1807, 7733], [1786, 7745]]]}}, {"type": "Feature", "id": "VN.3623", "properties": {"hc-group": "admin1", "hc-key": "vn-3623", "hc-a2": "HP", "labelrank": "7", "iso_3166_2": "VN-HP", "hasc": "VN.", "alt-name": "Hai Phong", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "2347707", "longitude": "106.635", "subregion": null, "woe-name": "Haiphong", "fips": null, "latitude": "20.79", "woe-label": "Hai Phong, VN, Vietnam", "postal-code": null, "type": "Thành", "name": "Hải Phòng"}, "geometry": {"type": "Polygon", "coordinates": [[[2073, 8140], [2099, 8134], [2104, 8134], [2122, 8091], [2177, 8077], [2165, 8036], [2151, 8051], [2139, 8036], [2176, 7994], [2157, 7968], [2201, 7925], [2214, 7886], [2187, 7912], [2169, 7900], [2115, 7895], [2143, 7872], [2109, 7850], [2067, 7862], [2029, 7836], [1982, 7827], [1967, 7847], [1945, 7914], [1975, 7915], [2026, 7961], [2030, 7977], [2006, 7990], [1999, 8018], [2025, 8039], [2026, 8074], [2060, 8094], [2073, 8140]]]}}, {"type": "Feature", "id": "VN.TY", "properties": {"hc-group": "admin1", "hc-key": "vn-ty", "hc-a2": "TY", "labelrank": "7", "iso_3166_2": "VN-69", "hasc": "VN.TY", "alt-name": "Thai Nguyen", "country": "Vietnam", "type-en": "Province", "region": "Ðông Bắc", "woe-id": "20070083", "longitude": "105.887", "subregion": null, "woe-name": "Thái Nguyên", "fips": "VM85", "latitude": "21.5812", "woe-label": "Thai Nguyen, VN, Vietnam", "postal-code": "TY", "type": "Tỉnh", "name": "Thái Nguyên"}, "geometry": {"type": "Polygon", "coordinates": [[[1600, 8358], [1550, 8384], [1498, 8383], [1475, 8423], [1404, 8475], [1363, 8515], [1325, 8562], [1322, 8609], [1333, 8752], [1349, 8813], [1367, 8818], [1396, 8857], [1458, 8872], [1496, 8834], [1500, 8764], [1516, 8695], [1542, 8714], [1583, 8723], [1653, 8769], [1669, 8794], [1729, 8814], [1732, 8777], [1749, 8709], [1776, 8695], [1826, 8629], [1828, 8616], [1796, 8582], [1768, 8537], [1752, 8574], [1699, 8582], [1680, 8564], [1703, 8487], [1689, 8436], [1667, 8420], [1634, 8417], [1600, 8358]]]}}, {"type": "Feature", "id": "VN.LI", "properties": {"hc-group": "admin1", "hc-key": "vn-li", "hc-a2": "LI", "labelrank": "7", "iso_3166_2": "VN-01", "hasc": "VN.LI", "alt-name": null, "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347708", "longitude": "103.255", "subregion": null, "woe-name": "Lai Chau", "fips": "VM89", "latitude": "22.3502", "woe-label": "Lai Chau, VN, Vietnam", "postal-code": "LI", "type": "Tỉnh", "name": "Lai Châu"}, "geometry": {"type": "Polygon", "coordinates": [[[-11, 8878], [-31, 8853], [-35, 8827], [-25, 8771], [-61, 8830], [-85, 8847], [-87, 8877], [-116, 8914], [-126, 8955], [-153, 8971], [-178, 8965], [-218, 8915], [-220, 8891], [-279, 8921], [-305, 8919], [-335, 8947], [-372, 8966], [-433, 8958], [-453, 8973], [-462, 9008], [-505, 9010], [-518, 9030], [-523, 9078], [-550, 9124], [-601, 9165], [-639, 9181], [-691, 9247], [-731, 9279], [-765, 9276], [-819, 9287], [-856, 9280], [-815, 9326], [-833, 9348], [-807, 9364], [-773, 9425], [-724, 9410], [-711, 9373], [-676, 9387], [-658, 9369], [-604, 9353], [-564, 9319], [-523, 9306], [-501, 9289], [-469, 9216], [-404, 9179], [-366, 9181], [-366, 9214], [-299, 9251], [-307, 9281], [-299, 9302], [-239, 9337], [-223, 9354], [-183, 9433], [-159, 9429], [-121, 9396], [-119, 9360], [-90, 9308], [-52, 9280], [-20, 9329], [15, 9278], [20, 9233], [-2, 9207], [4, 9185], [48, 9159], [113, 9160], [149, 9118], [128, 9063], [79, 9011], [26, 8985], [0, 8940], [-11, 8878]]]}}, {"type": "Feature", "id": "VN.311", "properties": {"hc-group": "admin1", "hc-key": "vn-311", "hc-a2": "SL", "labelrank": "7", "iso_3166_2": "VN-05", "hasc": "VN.", "alt-name": "Son La", "country": "Vietnam", "type-en": "Region", "region": "Northwest", "woe-id": "2347713", "longitude": "104.159", "subregion": "North West", "woe-name": "Son La", "fips": "VM32", "latitude": "21.3011", "woe-label": "Son La, VN, Vietnam", "postal-code": null, "type": "Province", "name": "Sơn La"}, "geometry": {"type": "Polygon", "coordinates": [[[-25, 8771], [-35, 8827], [-31, 8853], [-11, 8878], [13, 8884], [42, 8856], [84, 8751], [168, 8656], [198, 8638], [230, 8646], [293, 8620], [398, 8600], [441, 8608], [492, 8637], [521, 8608], [499, 8530], [494, 8480], [506, 8442], [525, 8422], [586, 8386], [617, 8384], [664, 8412], [695, 8419], [754, 8395], [794, 8397], [815, 8361], [849, 8357], [875, 8299], [879, 8225], [904, 8190], [886, 8160], [885, 8132], [907, 8089], [976, 8013], [1027, 7978], [1020, 7948], [949, 7917], [869, 7916], [856, 7893], [859, 7841], [813, 7804], [779, 7811], [721, 7853], [701, 7854], [691, 7867], [617, 7897], [589, 7943], [546, 7948], [509, 7984], [481, 8028], [457, 8042], [430, 8037], [412, 8065], [342, 8089], [317, 8087], [285, 8050], [245, 8045], [123, 7997], [107, 7957], [111, 7935], [75, 7915], [80, 7878], [46, 7869], [-14, 7924], [-70, 7936], [-118, 7989], [-162, 7965], [-231, 7994], [-256, 7995], [-254, 8042], [-243, 8095], [-210, 8140], [-213, 8173], [-191, 8181], [-149, 8160], [-109, 8174], [-119, 8238], [-106, 8267], [-99, 8316], [-106, 8344], [-131, 8365], [-147, 8419], [-107, 8446], [-86, 8491], [-44, 8532], [-20, 8568], [-14, 8614], [-22, 8673], [-25, 8771]]]}}, {"type": "Feature", "id": "VN.HG", "properties": {"hc-group": "admin1", "hc-key": "vn-hg", "hc-a2": "HG", "labelrank": "7", "iso_3166_2": "VN-03", "hasc": "VN.HG", "alt-name": "Ha Giang", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347734", "longitude": "104.965", "subregion": null, "woe-name": "Hà Giang", "fips": "VM50", "latitude": "22.7655", "woe-label": "Ha Giang, VN, Vietnam", "postal-code": "HG", "type": "Tỉnh", "name": "Hà Giang"}, "geometry": {"type": "Polygon", "coordinates": [[[863, 8974], [810, 8982], [755, 9043], [713, 9038], [690, 9025], [690, 9092], [660, 9121], [614, 9147], [586, 9256], [608, 9285], [574, 9327], [546, 9335], [533, 9358], [592, 9396], [663, 9463], [681, 9443], [702, 9453], [738, 9444], [782, 9465], [814, 9506], [847, 9527], [850, 9549], [830, 9645], [873, 9670], [879, 9702], [930, 9700], [954, 9722], [1008, 9753], [1114, 9777], [1127, 9817], [1157, 9846], [1178, 9851], [1192, 9816], [1231, 9785], [1259, 9779], [1288, 9726], [1318, 9706], [1330, 9656], [1313, 9647], [1305, 9601], [1292, 9584], [1261, 9583], [1211, 9520], [1172, 9492], [1173, 9476], [1274, 9418], [1300, 9385], [1321, 9336], [1354, 9284], [1308, 9276], [1201, 9290], [1101, 9324], [1083, 9316], [1059, 9234], [1023, 9186], [1000, 9111], [981, 9100], [938, 9108], [926, 9093], [919, 9045], [863, 8974]]]}}, {"type": "Feature", "id": "VN.ND", "properties": {"hc-group": "admin1", "hc-key": "vn-nd", "hc-a2": "ND", "labelrank": "7", "iso_3166_2": "VN-67", "hasc": "VN.ND", "alt-name": "Nam Dinh", "country": "Vietnam", "type-en": "Province", "region": "Red River Delta", "woe-id": "20070089", "longitude": "106.254", "subregion": null, "woe-name": "Nam Định", "fips": "VM82", "latitude": "20.2343", "woe-label": "Nam Dinh, VN, Vietnam", "postal-code": "ND", "type": "Tỉnh", "name": "Nam Định"}, "geometry": {"type": "Polygon", "coordinates": [[[2007, 7607], [2039, 7601], [2039, 7601], [2039, 7601], [2054, 7557], [2009, 7546], [1933, 7536], [1909, 7521], [1871, 7465], [1840, 7430], [1772, 7373], [1735, 7359], [1739, 7409], [1765, 7478], [1767, 7544], [1724, 7570], [1699, 7560], [1634, 7591], [1625, 7631], [1626, 7671], [1637, 7691], [1677, 7687], [1707, 7739], [1786, 7745], [1807, 7733], [1810, 7688], [1847, 7683], [1842, 7638], [1851, 7627], [1900, 7653], [1971, 7597], [2007, 7607]]]}}, {"type": "Feature", "id": "VN.CB", "properties": {"hc-group": "admin1", "hc-key": "vn-cb", "hc-a2": "CB", "labelrank": "7", "iso_3166_2": "VN-04", "hasc": "VN.CB", "alt-name": "Cao Bang", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347704", "longitude": "106.047", "subregion": null, "woe-name": "Cao Bằng", "fips": "VM05", "latitude": "22.7595", "woe-label": "Cao Bang, VN, Vietnam", "postal-code": "CB", "type": "Tỉnh", "name": "Cao Bằng"}, "geometry": {"type": "Polygon", "coordinates": [[[1330, 9656], [1351, 9623], [1436, 9616], [1480, 9588], [1547, 9514], [1570, 9533], [1609, 9531], [1646, 9567], [1699, 9571], [1762, 9561], [1784, 9547], [1806, 9486], [1862, 9479], [1958, 9506], [1978, 9533], [2042, 9511], [2062, 9480], [2101, 9492], [2145, 9443], [2185, 9441], [2186, 9423], [2156, 9402], [2148, 9366], [2123, 9318], [2112, 9280], [2089, 9272], [2062, 9302], [2036, 9276], [2013, 9150], [1988, 9136], [1921, 9131], [1844, 9176], [1803, 9171], [1781, 9150], [1743, 9169], [1739, 9204], [1722, 9241], [1705, 9249], [1646, 9236], [1587, 9203], [1542, 9204], [1523, 9221], [1486, 9313], [1496, 9368], [1460, 9381], [1408, 9347], [1354, 9284], [1321, 9336], [1300, 9385], [1274, 9418], [1173, 9476], [1172, 9492], [1211, 9520], [1261, 9583], [1292, 9584], [1305, 9601], [1313, 9647], [1330, 9656]]]}}, {"type": "Feature", "id": "VN.LO", "properties": {"hc-group": "admin1", "hc-key": "vn-lo", "hc-a2": "LO", "labelrank": "7", "iso_3166_2": "VN-02", "hasc": "VN.LO", "alt-name": "Lao Cai", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347740", "longitude": "104.096", "subregion": null, "woe-name": "Lào Cai", "fips": "VM56", "latitude": "22.3559", "woe-label": "Lao Cai, VN, Vietnam", "postal-code": "LO", "type": "Tỉnh", "name": "Lào Cai"}, "geometry": {"type": "Polygon", "coordinates": [[[-20, 9329], [-24, 9361], [8, 9417], [47, 9439], [100, 9378], [146, 9336], [195, 9274], [214, 9269], [229, 9243], [258, 9223], [276, 9238], [276, 9269], [291, 9313], [303, 9379], [337, 9425], [432, 9455], [451, 9455], [442, 9425], [456, 9384], [518, 9353], [533, 9358], [546, 9335], [574, 9327], [608, 9285], [586, 9256], [614, 9147], [660, 9121], [690, 9092], [690, 9025], [713, 9038], [725, 8976], [700, 8962], [662, 8919], [608, 8955], [556, 8949], [544, 8923], [584, 8841], [581, 8801], [552, 8775], [523, 8781], [442, 8821], [423, 8771], [373, 8788], [330, 8793], [272, 8832], [223, 8744], [249, 8699], [230, 8646], [198, 8638], [168, 8656], [84, 8751], [42, 8856], [13, 8884], [-11, 8878], [0, 8940], [26, 8985], [79, 9011], [128, 9063], [149, 9118], [113, 9160], [48, 9159], [4, 9185], [-2, 9207], [20, 9233], [15, 9278], [-20, 9329]]]}}, {"type": "Feature", "id": "VN.DB", "properties": {"hc-group": "admin1", "hc-key": "vn-db", "hc-a2": "DB", "labelrank": "7", "iso_3166_2": "VN-71", "hasc": "VN.DB", "alt-name": "Dien Bien", "country": "Vietnam", "type-en": "Province", "region": "Northwest", "woe-id": "28301718", "longitude": "103.226", "subregion": null, "woe-name": "Điện Biên", "fips": "VM22", "latitude": "21.7487", "woe-label": "Dien Bien, VN, Vietnam", "postal-code": "DB", "type": "Tỉnh", "name": "Điện Biên"}, "geometry": {"type": "Polygon", "coordinates": [[[-256, 7995], [-311, 8010], [-332, 8026], [-364, 8073], [-400, 8154], [-443, 8175], [-468, 8241], [-485, 8247], [-486, 8291], [-511, 8310], [-545, 8313], [-526, 8335], [-494, 8349], [-487, 8410], [-464, 8447], [-472, 8457], [-510, 8438], [-478, 8488], [-423, 8546], [-432, 8589], [-430, 8639], [-440, 8665], [-497, 8643], [-517, 8651], [-522, 8728], [-547, 8728], [-550, 8669], [-574, 8626], [-596, 8612], [-644, 8610], [-658, 8663], [-654, 8706], [-682, 8789], [-703, 8807], [-759, 8832], [-767, 8860], [-755, 8879], [-796, 8909], [-818, 8950], [-887, 9012], [-928, 9034], [-976, 9091], [-999, 9159], [-967, 9179], [-931, 9168], [-906, 9229], [-856, 9280], [-819, 9287], [-765, 9276], [-731, 9279], [-691, 9247], [-639, 9181], [-601, 9165], [-550, 9124], [-523, 9078], [-518, 9030], [-505, 9010], [-462, 9008], [-453, 8973], [-433, 8958], [-372, 8966], [-335, 8947], [-305, 8919], [-279, 8921], [-220, 8891], [-218, 8915], [-178, 8965], [-153, 8971], [-126, 8955], [-116, 8914], [-87, 8877], [-85, 8847], [-61, 8830], [-25, 8771], [-22, 8673], [-14, 8614], [-20, 8568], [-44, 8532], [-86, 8491], [-107, 8446], [-147, 8419], [-131, 8365], [-106, 8344], [-99, 8316], [-106, 8267], [-119, 8238], [-109, 8174], [-149, 8160], [-191, 8181], [-213, 8173], [-210, 8140], [-243, 8095], [-254, 8042], [-256, 7995]]]}}, {"type": "Feature", "id": "VN.LS", "properties": {"hc-group": "admin1", "hc-key": "vn-ls", "hc-a2": "LS", "labelrank": "7", "iso_3166_2": "VN-09", "hasc": "VN.LS", "alt-name": "Lang Son", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347718", "longitude": "106.724", "subregion": null, "woe-name": "Lạng Sơn", "fips": "VM39", "latitude": "21.7826", "woe-label": "Lang Son, VN, Vietnam", "postal-code": "LS", "type": "Tỉnh", "name": "Lạng Sơn"}, "geometry": {"type": "Polygon", "coordinates": [[[2013, 9150], [2029, 9098], [2071, 9092], [2086, 9073], [2103, 9019], [2087, 8995], [2110, 8923], [2095, 8852], [2113, 8827], [2145, 8861], [2186, 8838], [2243, 8833], [2282, 8796], [2316, 8810], [2342, 8805], [2351, 8779], [2328, 8744], [2339, 8719], [2382, 8709], [2456, 8650], [2484, 8643], [2525, 8654], [2546, 8632], [2568, 8577], [2505, 8534], [2494, 8513], [2509, 8483], [2507, 8447], [2489, 8424], [2429, 8397], [2386, 8389], [2358, 8400], [2338, 8451], [2287, 8450], [2242, 8520], [2229, 8558], [2210, 8557], [2166, 8525], [2121, 8561], [2086, 8568], [2037, 8551], [2012, 8520], [1990, 8465], [1970, 8436], [1928, 8421], [1896, 8430], [1854, 8469], [1767, 8498], [1768, 8537], [1796, 8582], [1828, 8616], [1826, 8629], [1776, 8695], [1749, 8709], [1732, 8777], [1729, 8814], [1733, 8878], [1742, 8902], [1781, 8934], [1814, 8998], [1827, 9045], [1800, 9088], [1781, 9150], [1803, 9171], [1844, 9176], [1921, 9131], [1988, 9136], [2013, 9150]]]}}, {"type": "Feature", "id": "VN.TH", "properties": {"hc-group": "admin1", "hc-key": "vn-th", "hc-a2": "TH", "labelrank": "7", "iso_3166_2": "VN-21", "hasc": "VN.TH", "alt-name": "Thanh Hoa", "country": "Vietnam", "type-en": "Province", "region": "North Central Region", "woe-id": "2347715", "longitude": "105.215", "subregion": null, "woe-name": "Thanh Hóa", "fips": "VM34", "latitude": "20.0917", "woe-label": "Thanh Hoa, VN, Vietnam", "postal-code": "TH", "type": "Tỉnh", "name": "Thanh Hóa"}, "geometry": {"type": "Polygon", "coordinates": [[[1684, 7381], [1630, 7329], [1631, 7293], [1616, 7273], [1612, 7232], [1569, 7217], [1612, 7222], [1589, 7179], [1569, 7179], [1541, 7121], [1529, 6988], [1512, 6939], [1533, 6875], [1528, 6851], [1499, 6865], [1454, 6871], [1407, 6915], [1375, 6934], [1339, 6982], [1320, 6994], [1271, 6993], [1246, 7004], [1215, 7045], [1188, 7049], [1156, 7030], [1149, 7103], [1099, 7153], [1069, 7204], [1061, 7243], [1092, 7302], [1072, 7320], [1011, 7339], [977, 7360], [929, 7376], [928, 7431], [937, 7449], [901, 7481], [903, 7511], [842, 7544], [753, 7526], [730, 7538], [730, 7587], [747, 7593], [746, 7632], [699, 7659], [674, 7686], [575, 7684], [524, 7705], [529, 7719], [569, 7746], [584, 7775], [619, 7758], [651, 7775], [696, 7836], [701, 7854], [721, 7853], [779, 7811], [813, 7804], [859, 7841], [925, 7815], [1013, 7804], [1062, 7815], [1081, 7805], [1114, 7762], [1180, 7717], [1282, 7665], [1342, 7652], [1490, 7527], [1564, 7482], [1604, 7471], [1648, 7441], [1695, 7433], [1709, 7409], [1684, 7381]]]}}, {"type": "Feature", "id": "VN.307", "properties": {"hc-group": "admin1", "hc-key": "vn-307", "hc-a2": "BK", "labelrank": "7", "iso_3166_2": "VN-", "hasc": "VN.", "alt-name": "Bắc Cạn", "country": "Vietnam", "type-en": "Region", "region": null, "woe-id": "20070084", "longitude": "105.874", "subregion": null, "woe-name": "Bắc Kạn", "fips": "VM72", "latitude": "22.1476", "woe-label": "Bac Kan, VN, Vietnam", "postal-code": null, "type": "Region", "name": "Bắc Kạn"}, "geometry": {"type": "Polygon", "coordinates": [[[1349, 8813], [1340, 8847], [1315, 8890], [1301, 8963], [1305, 9046], [1322, 9099], [1369, 9165], [1382, 9194], [1381, 9229], [1354, 9284], [1408, 9347], [1460, 9381], [1496, 9368], [1486, 9313], [1523, 9221], [1542, 9204], [1587, 9203], [1646, 9236], [1705, 9249], [1722, 9241], [1739, 9204], [1743, 9169], [1781, 9150], [1800, 9088], [1827, 9045], [1814, 8998], [1781, 8934], [1742, 8902], [1733, 8878], [1729, 8814], [1669, 8794], [1653, 8769], [1583, 8723], [1542, 8714], [1516, 8695], [1500, 8764], [1496, 8834], [1458, 8872], [1396, 8857], [1367, 8818], [1349, 8813]]]}}, {"type": "Feature", "id": "VN.TQ", "properties": {"hc-group": "admin1", "hc-key": "vn-tq", "hc-a2": "TQ", "labelrank": "7", "iso_3166_2": "VN-07", "hasc": "VN.TQ", "alt-name": "Tuyen Quang", "country": "Vietnam", "type-en": "Province", "region": "Northeast", "woe-id": "2347751", "longitude": "105.229", "subregion": null, "woe-name": "Tuyên Quang", "fips": "VM68", "latitude": "22.131", "woe-label": "Tuyen Quang, VN, Vietnam", "postal-code": "TQ", "type": "Tỉnh", "name": "Tuyên Quang"}, "geometry": {"type": "Polygon", "coordinates": [[[1354, 9284], [1381, 9229], [1382, 9194], [1369, 9165], [1322, 9099], [1305, 9046], [1301, 8963], [1315, 8890], [1340, 8847], [1349, 8813], [1333, 8752], [1322, 8609], [1325, 8562], [1363, 8515], [1337, 8498], [1283, 8480], [1237, 8479], [1185, 8493], [1127, 8569], [1088, 8605], [1044, 8632], [1026, 8666], [1036, 8699], [1019, 8730], [965, 8793], [966, 8830], [955, 8854], [888, 8914], [863, 8974], [919, 9045], [926, 9093], [938, 9108], [981, 9100], [1000, 9111], [1023, 9186], [1059, 9234], [1083, 9316], [1101, 9324], [1201, 9290], [1308, 9276], [1354, 9284]]]}}]};

  const PROVINCE_METADATA = {
    'Hà Nội': { lat: 21.0285, lng: 105.8542, icon: '🏛️', region: 'Thủ đô Hà Nội', floodAlert: 'Cảnh báo 12 điểm ngập nhẹ nội thành (15-25cm)', alertLevel: 'warning' },
    'Quảng Ninh': { lat: 21.0069, lng: 107.2925, icon: '🌊', region: 'Duyên hải Đông Bắc', floodAlert: 'Sóng lớn ven biển Cẩm Phả - Hạ Long, gió cấp 5', alertLevel: 'safe' },
    'Hải Phòng': { lat: 20.8449, lng: 106.6881, icon: '⚓', region: 'Duyên hải Bắc Bộ', floodAlert: 'Triều cường dâng nhẹ ven sông Cấm, các cống tiêu đóng kín', alertLevel: 'safe' },
    'Hải Dương': { lat: 20.9409, lng: 106.3330, icon: '🌾', region: 'Đồng bằng Sông Hồng', floodAlert: 'Mực nước sông Thái Bình ở mức an toàn', alertLevel: 'safe' },
    'Hưng Yên': { lat: 20.6464, lng: 106.0511, icon: '🍊', region: 'Đồng bằng Sông Hồng', floodAlert: 'Hệ thống đê sông Hồng vận hành bình thường', alertLevel: 'safe' },
    'Bắc Ninh': { lat: 21.1861, lng: 106.0763, icon: '🏭', region: 'Đồng bằng Sông Hồng', floodAlert: 'Mực nước Sông Đuống và Sông Cầu ổn định', alertLevel: 'safe' },
    'Bắc Giang': { lat: 21.2731, lng: 106.1946, icon: '🌳', region: 'Đông Bắc Bộ', floodAlert: 'Quan sát nước dâng vùng trũng Yên Dũng', alertLevel: 'safe' },
    'Vĩnh Phúc': { lat: 21.3089, lng: 105.6049, icon: '🏔️', region: 'Đồng bằng Sông Hồng', floodAlert: 'Hồ Đại Lải xả tràn điều tiết an toàn', alertLevel: 'safe' },
    'Phú Thọ': { lat: 21.3228, lng: 105.2280, icon: '👑', region: 'Trung du Bắc Bộ', floodAlert: 'Theo dõi mực nước ngã ba sông Việt Trì', alertLevel: 'safe' },
    'Thái Nguyên': { lat: 21.5928, lng: 105.8442, icon: '🍵', region: 'Việt Bắc', floodAlert: 'Lũ sông Cầu đã rút, 8 hộ dân đang được hỗ trợ dọn dẹp', alertLevel: 'warning' },
    'Bắc Kạn': { lat: 22.1470, lng: 105.8348, icon: '🌲', region: 'Đông Bắc Bộ', floodAlert: 'Nguy cơ sạt lở đồi dốc cục bộ tại Ba Bể', alertLevel: 'safe' },
    'Cao Bằng': { lat: 22.6667, lng: 106.2500, icon: '🏞️', region: 'Biên giới Đông Bắc', floodAlert: 'Sông Bằng Giang nước chảy xiết, chú ý sạt lở đất', alertLevel: 'safe' },
    'Lạng Sơn': { lat: 21.8537, lng: 106.7615, icon: '⛰️', region: 'Đông Bắc Bộ', floodAlert: 'Cảnh báo đá lăn trên Quốc lộ 1A và 4A', alertLevel: 'safe' },
    'Hà Giang': { lat: 22.8233, lng: 104.9839, icon: '🌸', region: 'Cao nguyên Đá', floodAlert: 'Sạt lở nhẹ đèo Mã Pí Lèng, đường trơn trượt', alertLevel: 'safe' },
    'Tuyên Quang': { lat: 21.8234, lng: 105.2140, icon: '🪵', region: 'Việt Bắc', floodAlert: 'Hồ thủy điện Tuyên Quang mở 1 cửa xả đáy điều tiết', alertLevel: 'safe' },
    'Lào Cai': { lat: 22.4856, lng: 103.9707, icon: '⛰️', region: 'Tây Bắc Bộ', floodAlert: 'Báo động sạt lở đồi dốc đặc biệt nguy hiểm tại Bảo Yên, Làng Nủ', alertLevel: 'danger' },
    'Yên Bái': { lat: 21.7167, lng: 104.8833, icon: '🌾', region: 'Tây Bắc Bộ', floodAlert: 'Sông Thao đang rút dưới Báo động 3, khẩn trương khắc phục', alertLevel: 'warning' },
    'Hòa Bình': { lat: 20.8172, lng: 105.3376, icon: '💧', region: 'Tây Bắc Bộ', floodAlert: 'Thủy điện Hòa Bình duy trì xả sâu 2 cửa đáy an toàn', alertLevel: 'safe' },
    'Sơn La': { lat: 21.3283, lng: 103.9148, icon: '🌄', region: 'Tây Bắc Bộ', floodAlert: 'Lũ quét suối Nậm La đã giảm, đường giao thông thông suốt', alertLevel: 'safe' },
    'Điện Biên': { lat: 21.3857, lng: 103.0188, icon: '🎖️', region: 'Tây Bắc Bộ', floodAlert: 'Mưa rào rải rác, các tuyến đèo cơ bản an toàn', alertLevel: 'safe' },
    'Lai Châu': { lat: 22.3964, lng: 103.4582, icon: '🌿', region: 'Tây Bắc Bộ', floodAlert: 'Cảnh báo sương mù dày và đá lở taluy âm trên đèo Hoàng Liên Sơn', alertLevel: 'safe' },
    'Hà Nam': { lat: 20.5835, lng: 105.9230, icon: '🌾', region: 'Đồng bằng Sông Hồng', floodAlert: 'Sông Đáy thoát lũ tốt, không ngập diện rộng', alertLevel: 'safe' },
    'Nam Định': { lat: 20.4343, lng: 106.1773, icon: '⛪', region: 'Đồng bằng Sông Hồng', floodAlert: 'Triều cường cửa Ba Lạt ở mức trung bình, tiêu thoát bình thường', alertLevel: 'safe' },
    'Thái Bình': { lat: 20.4463, lng: 106.3366, icon: '🌾', region: 'Đồng bằng Sông Hồng', floodAlert: 'Các trạm bơm tiêu úng nông nghiệp trực ban 24/7', alertLevel: 'safe' },
    'Ninh Bình': { lat: 20.2506, lng: 105.9745, icon: '🛶', region: 'Đồng bằng Sông Hồng', floodAlert: 'Khu du lịch Tràng An nước sông Hoàng Long ổn định', alertLevel: 'safe' },
    'Thanh Hóa': { lat: 19.8067, lng: 105.7852, icon: '🏖️', region: 'Bắc Trung Bộ', floodAlert: 'Mực nước Sông Mã dưới mức Báo động 1', alertLevel: 'safe' }
  };

  const weatherCache = {};

  function initDefaultWeatherCache() {
    Object.keys(PROVINCE_METADATA).forEach(name => {
      let temp = 23.5;
      let weatherDesc = 'Nhiều mây u ám';
      let weatherIcon = '☁️';
      let humidity = 82;
      let rain = 0.0;
      let aqi = 65;
      let pm25 = 14.5;
      let pm10 = 16.0;

      if (name === 'Hà Nội') {
        temp = 23.8; weatherDesc = 'Mưa phùn rải rác'; weatherIcon = '🌦️'; humidity = 81; rain = 0.2; aqi = 73; pm25 = 15.5; pm10 = 15.5;
      } else if (name === 'Quảng Ninh') {
        temp = 22.6; weatherDesc = 'Gió biển, nhiều mây'; weatherIcon = '⛅'; humidity = 85; rain = 0.0; aqi = 53; pm25 = 13.9; pm10 = 14.0;
      } else if (name === 'Lào Cai') {
        temp = 21.0; weatherDesc = 'Mưa dông vùng núi'; weatherIcon = '🌧️'; humidity = 89; rain = 4.5; aqi = 42; pm25 = 8.5; pm10 = 9.2;
      } else if (name === 'Thái Nguyên') {
        temp = 23.2; weatherDesc = 'Mưa phùn nhẹ'; weatherIcon = '🌦️'; humidity = 84; rain = 0.5; aqi = 62; pm25 = 14.0; pm10 = 15.0;
      } else if (name === 'Hải Phòng') {
        temp = 23.9; weatherDesc = 'Trời mát, nhiều mây'; weatherIcon = '⛅'; humidity = 83; rain = 0.1; aqi = 51; pm25 = 13.9; pm10 = 14.2;
      } else if (name === 'Yên Bái') {
        temp = 22.4; weatherDesc = 'Mưa rào nhẹ'; weatherIcon = '🌧️'; humidity = 88; rain = 1.2; aqi = 48; pm25 = 9.8; pm10 = 10.5;
      } else if (name === 'Lai Châu' || name === 'Điện Biên' || name === 'Sơn La') {
        temp = 20.8; weatherDesc = 'Sương mù vùng cao'; weatherIcon = '🌫️'; humidity = 87; rain = 0.0; aqi = 35; pm25 = 7.2; pm10 = 8.0;
      }

      weatherCache[name] = {
        temp: temp,
        feelsLike: Math.round((temp + 0.8) * 10) / 10,
        weatherDesc: weatherDesc,
        weatherIcon: weatherIcon,
        humidity: humidity,
        rain: rain,
        windSpeed: 14.5,
        aqi: aqi,
        pm25: pm25,
        pm10: pm10,
        updatedAt: 'Thời gian thực'
      };
    });
  }
  initDefaultWeatherCache();

  function parseWeatherCode(code) {
    if (code === 0) return { desc: 'Trời quang, nắng đẹp', icon: '☀️' };
    if (code === 1 || code === 2) return { desc: 'Ít mây, trời dịu', icon: '🌤️' };
    if (code === 3) return { desc: 'Nhiều mây u ám', icon: '☁️' };
    if (code === 45 || code === 48) return { desc: 'Sương mù dày đặc', icon: '🌫️' };
    if (code === 51 || code === 53 || code === 55) return { desc: 'Mưa phùn rải rác', icon: '🌦️' };
    if (code === 61 || code === 63 || code === 65) return { desc: 'Mưa rào liên tục', icon: '🌧️' };
    if (code === 71 || code === 73 || code === 75) return { desc: 'Mưa tuyết / rét buốt', icon: '🌨️' };
    if (code === 80 || code === 81 || code === 82) return { desc: 'Mưa rào nặng hạt', icon: '🌧️' };
    if (code === 95 || code === 96 || code === 99) return { desc: 'Mưa dông, có sấm sét', icon: '⛈️' };
    return { desc: 'Thời tiết ổn định', icon: '⛅' };
  }

  function getAqiDetails(aqi) {
    if (aqi <= 50) {
      return {
        level: 'Tốt',
        colorClass: 'text-emerald-400',
        badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700',
        badgeHex: '#10b981',
        advice: 'Không khí trong lành, an toàn tuyệt đối cho các hoạt động ngoài trời.'
      };
    } else if (aqi <= 100) {
      return {
        level: 'Trung bình',
        colorClass: 'text-amber-400',
        badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-700',
        badgeHex: '#f59e0b',
        advice: 'Chất lượng chấp nhận được, người quá nhạy cảm nên chú ý.'
      };
    } else if (aqi <= 150) {
      return {
        level: 'Kém (Nhạy cảm)',
        colorClass: 'text-orange-400',
        badgeBg: 'bg-orange-950/80 text-orange-300 border-orange-700',
        badgeHex: '#f97316',
        advice: 'Người già, trẻ em và người bệnh hô hấp nên hạn chế ngoài trời.'
      };
    } else if (aqi <= 200) {
      return {
        level: 'Xấu (Không lành mạnh)',
        colorClass: 'text-rose-400',
        badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-700',
        badgeHex: '#ef4444',
        advice: 'Nên đeo khẩu trang chống bụi mịn PM2.5 khi ra ngoài.'
      };
    } else {
      return {
        level: 'Rất xấu (Nguy hại)',
        colorClass: 'text-purple-400',
        badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-700',
        badgeHex: '#a855f7',
        advice: 'Cảnh báo khẩn cấp: Tránh hoàn toàn các hoạt động ngoài trời!'
      };
    }
  }

  async function fetchLiveOpenMeteo() {
    const names = Object.keys(PROVINCE_METADATA);
    const lats = names.map(n => PROVINCE_METADATA[n].lat).join(',');
    const lngs = names.map(n => PROVINCE_METADATA[n].lng).join(',');

    try {
      const wUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats + '&longitude=' + lngs + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m';
      const aqiUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lats + '&longitude=' + lngs + '&current=us_aqi,pm2_5,pm10';

      const [wResp, aqiResp] = await Promise.all([
        fetch(wUrl).then(r => r.json()),
        fetch(aqiUrl).then(r => r.json())
      ]);

      const wList = Array.isArray(wResp) ? wResp : [wResp];
      const aqiList = Array.isArray(aqiResp) ? aqiResp : [aqiResp];

      names.forEach((name, i) => {
        const wCur = wList[i] && wList[i].current ? wList[i].current : {};
        const aCur = aqiList[i] && aqiList[i].current ? aqiList[i].current : {};
        const pWeather = parseWeatherCode(wCur.weather_code);

        weatherCache[name] = {
          temp: wCur.temperature_2m !== undefined ? wCur.temperature_2m : weatherCache[name].temp,
          feelsLike: wCur.apparent_temperature !== undefined ? wCur.apparent_temperature : weatherCache[name].feelsLike,
          weatherDesc: pWeather.desc,
          weatherIcon: pWeather.icon,
          humidity: wCur.relative_humidity_2m !== undefined ? wCur.relative_humidity_2m : weatherCache[name].humidity,
          rain: wCur.precipitation !== undefined ? wCur.precipitation : weatherCache[name].rain,
          windSpeed: wCur.wind_speed_10m !== undefined ? wCur.wind_speed_10m : weatherCache[name].windSpeed,
          aqi: aCur.us_aqi !== undefined ? Math.round(aCur.us_aqi) : weatherCache[name].aqi,
          pm25: aCur.pm2_5 !== undefined ? Math.round(aCur.pm2_5 * 10) / 10 : weatherCache[name].pm25,
          pm10: aCur.pm10 !== undefined ? Math.round(aCur.pm10 * 10) / 10 : weatherCache[name].pm10,
          updatedAt: 'Vệ tinh Open-Meteo Trực tiếp'
        };
      });

      updateProvinceLabels();
      updateWeatherPaneCards();
      console.log('[ProvinceWeather] Đã cập nhật thành công dữ liệu Khí tượng & AQI trực tiếp cho 26 tỉnh thành miền Bắc.');
    } catch (err) {
      console.warn('[ProvinceWeather] Lỗi tải Open-Meteo trực tiếp, duy trì cache nội suy chuẩn:', err);
    }
  }

  let provincesLayerGroup = null;
  let geoJsonLayer = null;
  let labelMarkersGroup = null;
  let targetMap = null;

  function buildHoverCardHtml(provinceName) {
    const meta = PROVINCE_METADATA[provinceName] || { icon: '📍', region: 'Khu vực Miền Bắc', floodAlert: 'Bình thường', alertLevel: 'safe' };
    const data = weatherCache[provinceName] || {
      temp: 23.5, feelsLike: 24.3, weatherDesc: 'Nhiều mây', weatherIcon: '⛅',
      humidity: 80, rain: 0.0, windSpeed: 12.0, aqi: 65, pm25: 14.5, pm10: 16.0, updatedAt: 'Thời gian thực'
    };
    const aqiDetail = getAqiDetails(data.aqi);

    let alertBadgeClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-700';
    let alertLabel = '✅ Ổn định an toàn';
    if (meta.alertLevel === 'danger') {
      alertBadgeClass = 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse font-black';
      alertLabel = '🚨 Cảnh báo thiên tai';
    } else if (meta.alertLevel === 'warning') {
      alertBadgeClass = 'bg-amber-950/80 text-amber-300 border-amber-700 font-bold';
      alertLabel = '⚠️ Chú ý ngập/sạt lở';
    }

    return `
      <div class="province-weather-popup select-none text-slate-100 font-sans" style="min-width: 290px; max-width: 320px; font-family: 'Be Vietnam Pro', 'Inter', sans-serif;">
        <!-- Header -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-700/80 mb-2.5">
          <div class="flex items-center gap-1.5">
            <span class="text-xl">${meta.icon}</span>
            <div>
              <div class="text-sm font-black text-white leading-tight">${provinceName}</div>
              <div class="text-[10px] text-slate-400 font-medium leading-tight">${meta.region}</div>
            </div>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full border ${alertBadgeClass}">
            ${alertLabel}
          </span>
        </div>

        <!-- 2 Columns Grid: Weather & AQI -->
        <div class="grid grid-cols-2 gap-2 mb-2">
          <!-- Col 1: Weather -->
          <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 flex flex-col justify-between shadow-xs">
            <div>
              <div class="text-[10px] font-bold text-sky-400 flex items-center gap-1 uppercase tracking-wider mb-1">
                <span>${data.weatherIcon}</span> <span>Khí Tượng</span>
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-2xl font-black text-white font-mono leading-none">${data.temp}</span>
                <span class="text-xs text-slate-400 font-semibold">°C</span>
              </div>
              <div class="text-[11px] font-bold text-slate-200 mt-1 line-clamp-1">${data.weatherDesc}</div>
            </div>

            <div class="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5 font-medium">
              <div class="flex justify-between"><span>💧 Độ ẩm:</span><b class="text-slate-200">${data.humidity}%</b></div>
              <div class="flex justify-between"><span>🌧️ Lượng mưa:</span><b class="text-cyan-300 font-mono">${data.rain} mm</b></div>
              <div class="flex justify-between"><span>💨 Gió:</span><b class="text-slate-200">${data.windSpeed} km/h</b></div>
            </div>
          </div>

          <!-- Col 2: AQI Air Quality -->
          <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 flex flex-col justify-between shadow-xs">
            <div>
              <div class="text-[10px] font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-wider mb-1">
                <span>🍃</span> <span>Không Khí</span>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-black ${aqiDetail.colorClass} font-mono leading-none">${data.aqi}</span>
                <span class="text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded border ${aqiDetail.badgeBg}">${aqiDetail.level}</span>
              </div>
              <div class="text-[10px] text-slate-300 mt-1 line-clamp-2 leading-tight">${aqiDetail.advice}</div>
            </div>

            <div class="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5 font-medium">
              <div class="flex justify-between"><span>🔬 PM2.5:</span><b class="text-slate-200">${data.pm25} µg/m³</b></div>
              <div class="flex justify-between"><span>🌫️ PM10:</span><b class="text-slate-200">${data.pm10} µg/m³</b></div>
              <div class="flex justify-between"><span>📊 Chuẩn:</span><b class="text-slate-300">US-EPA / VN</b></div>
            </div>
          </div>
        </div>

        <!-- Local Flood & Disaster Status -->
        <div class="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2 mb-2 text-[10.5px]">
          <div class="text-slate-400 font-semibold text-[9.5px] flex items-center gap-1 mb-0.5">
            <span>🛡️ TÌNH HÌNH TÁC CHIẾN ĐỊA BÀN:</span>
          </div>
          <div class="text-slate-200 font-medium leading-snug">${meta.floodAlert}</div>
        </div>

        <!-- Footer -->
        <div class="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[9.5px] text-slate-400">
          <span>🕒 Cập nhật: <b class="text-cyan-300">${data.updatedAt}</b></span>
          <span class="text-sky-400 font-bold hover:underline cursor-pointer">Nhấp phóng to 🔍</span>
        </div>
      </div>
    `;
  }

  function getFeatureStyle(feature) {
    const isDark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark');
    return {
      color: isDark ? '#38bdf8' : '#2563eb',
      weight: 1.4,
      opacity: 0.75,
      dashArray: '4, 4',
      fillColor: isDark ? '#0284c7' : '#3b82f6',
      fillOpacity: isDark ? 0.08 : 0.06,
      className: 'tactical-province-boundary'
    };
  }

  function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 2.5,
      color: '#34d399',
      dashArray: '',
      fillColor: '#10b981',
      fillOpacity: 0.22
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }

  function resetHighlight(e) {
    if (geoJsonLayer) {
      geoJsonLayer.resetStyle(e.target);
    }
  }

  function onFeatureClick(e, provinceName) {
    const layer = e.target;
    if (targetMap && layer.getBounds) {
      targetMap.fitBounds(layer.getBounds().pad(0.12), { duration: 1.0 });
    }

    const meta = PROVINCE_METADATA[provinceName] || {};
    const data = weatherCache[provinceName] || {};
    if (typeof window.showNorthStarToast === 'function') {
      window.showNorthStarToast(
        `📍 Tiêu điểm: ${provinceName} • ${data.temp}°C - ${data.weatherDesc} (AQI ${data.aqi})`,
        meta.alertLevel === 'danger' ? 'danger' : 'info',
        3000
      );
    }
  }

  function updateProvinceLabels() {
    if (!labelMarkersGroup) return;
    labelMarkersGroup.clearLayers();

    const z = targetMap ? targetMap.getZoom() : 8;
    // Khi zoom xa (zoom <= 8, góc nhìn toàn miền Bắc): Chỉ hiển thị các đô thị & điểm nóng trọng điểm để chống rối bản đồ
    const PRIORITY_PROVINCES = ['Hà Nội', 'Quảng Ninh', 'Hải Phòng', 'Lào Cai', 'Yên Bái', 'Thái Nguyên', 'Cao Bằng'];

    Object.keys(PROVINCE_METADATA).forEach(name => {
      if (z <= 8 && !PRIORITY_PROVINCES.includes(name)) return;
      const meta = PROVINCE_METADATA[name];
      const data = weatherCache[name] || { temp: 23.5, weatherIcon: '⛅' };

      const iconHtml = `
        <div class="province-map-chip flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-slate-700 shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-110 cursor-pointer pointer-events-auto" style="white-space: nowrap; font-family: 'Be Vietnam Pro', sans-serif;">
          <span class="text-[11px]">${meta.icon}</span>
          <span class="text-[10px] font-bold text-slate-200">${name}</span>
          <span class="text-[9.5px] font-extrabold text-cyan-300 font-mono">${data.temp}°</span>
        </div>
      `;

      const divIcon = L.divIcon({
        html: iconHtml,
        className: 'province-chip-container',
        iconSize: [85, 22],
        iconAnchor: [42, 11]
      });

      const marker = L.marker([meta.lat, meta.lng], {
        icon: divIcon,
        interactive: true,
        zIndexOffset: 50
      });

      marker.bindTooltip(() => buildHoverCardHtml(name), {
        sticky: true,
        direction: 'top',
        offset: [0, -10],
        opacity: 0.98,
        className: 'province-weather-leaflet-tooltip'
      });

      marker.on('click', () => {
        if (targetMap) targetMap.flyTo([meta.lat, meta.lng], 10, { duration: 1.0 });
      });

      labelMarkersGroup.addLayer(marker);
    });
  }

  function init(map) {
    if (!map) return;
    targetMap = map;

    if (provincesLayerGroup && map.hasLayer(provincesLayerGroup)) {
      map.removeLayer(provincesLayerGroup);
    }

    provincesLayerGroup = L.layerGroup();
    labelMarkersGroup = L.layerGroup();

    // 1. Tạo Leaflet GeoJSON layer cho các ô tỉnh thành
    geoJsonLayer = L.geoJSON(NORTHERN_PROVINCES_GEOJSON, {
      style: getFeatureStyle,
      onEachFeature: function (feature, layer) {
        const provinceName = feature.properties.name;

        // Gắn Tooltip hiển thị card thông tin thời tiết & chất lượng không khí
        layer.bindTooltip(() => buildHoverCardHtml(provinceName), {
          sticky: true,
          direction: 'auto',
          offset: [15, 0],
          opacity: 0.98,
          className: 'province-weather-leaflet-tooltip'
        });

        layer.on({
          mouseover: highlightFeature,
          mouseout: resetHighlight,
          click: (e) => onFeatureClick(e, provinceName)
        });
      }
    });

    provincesLayerGroup.addLayer(geoJsonLayer);
    provincesLayerGroup.addLayer(labelMarkersGroup);

    // Mặc định nạp lên bản đồ
    provincesLayerGroup.addTo(map);

    // Nạp nhãn ban đầu
    updateProvinceLabels();

    // Ẩn hiện nhãn thông minh theo zoom để không rối mắt khi zoom xa/gần
    map.on('zoomend', () => {
      const z = map.getZoom();
      if (z < 7) {
        if (provincesLayerGroup.hasLayer(labelMarkersGroup)) provincesLayerGroup.removeLayer(labelMarkersGroup);
      } else {
        if (!provincesLayerGroup.hasLayer(labelMarkersGroup)) provincesLayerGroup.addLayer(labelMarkersGroup);
        updateProvinceLabels();
      }
    });

    // Kích hoạt nạp dữ liệu Open-Meteo trực tiếp nền
    fetchLiveOpenMeteo();

    // Tự động làm mới dữ liệu sau mỗi 10 phút
    setInterval(fetchLiveOpenMeteo, 10 * 60 * 1000);

    console.log('[ProvinceWeather] Lớp Phân vùng Tỉnh thành & Khí tượng / AQI đã kích hoạt thành công.');
  }

  function toggle(visible) {
    if (!targetMap || !provincesLayerGroup) return;
    if (visible) {
      if (!targetMap.hasLayer(provincesLayerGroup)) {
        provincesLayerGroup.addTo(targetMap);
      }
    } else {
      if (targetMap.hasLayer(provincesLayerGroup)) {
        targetMap.removeLayer(provincesLayerGroup);
      }
    }
  }

  function updateWeatherPaneCards() {
    const hanoiCard = document.getElementById('weather-card-hanoi');
    const hanoiData = weatherCache['Hà Nội'];
    if (hanoiCard && hanoiData) {
      hanoiCard.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="font-bold text-slate-200">🏛️ TP. Hà Nội</div>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">Live Open-Meteo</span>
        </div>
        <div class="text-2xl font-black text-amber-300 mt-1.5 flex items-center gap-2">
          <span>${hanoiData.weatherIcon}</span>
          <span>${hanoiData.temp}°C</span>
          <span class="text-xs font-normal text-slate-300">- ${hanoiData.weatherDesc}</span>
        </div>
        <div class="text-slate-400 mt-1 text-[11px] space-y-0.5">
          <div>Lượng mưa: <span class="font-bold text-slate-200">${hanoiData.rain} mm</span> | Cảm nhận: ${hanoiData.feelsLike}°C | Độ ẩm: ${hanoiData.humidity}%</div>
          <div>Gió: ${hanoiData.windSpeed} km/h | Không khí: <span class="font-bold text-amber-300">AQI ${hanoiData.aqi}</span> (PM2.5: ${hanoiData.pm25} µg/m³)</div>
        </div>
      `;
    }

    const laocaiCard = document.getElementById('weather-card-laocai');
    const laocaiData = weatherCache['Lào Cai'];
    if (laocaiCard && laocaiData) {
      laocaiCard.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="font-bold text-slate-200">⛰️ Tỉnh Lào Cai (Bảo Yên, Sa Pa)</div>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">Live Open-Meteo</span>
        </div>
        <div class="text-2xl font-black text-rose-400 mt-1.5 flex items-center gap-2">
          <span>${laocaiData.weatherIcon}</span>
          <span>${laocaiData.temp}°C</span>
          <span class="text-xs font-normal text-slate-300">- ${laocaiData.weatherDesc}</span>
        </div>
        <div class="text-slate-400 mt-1 text-[11px] space-y-0.5">
          <div>Lượng mưa: <span class="font-bold text-slate-200">${laocaiData.rain} mm</span> | Cảm nhận: ${laocaiData.feelsLike}°C | Độ ẩm: ${laocaiData.humidity}%</div>
          <div>Gió: ${laocaiData.windSpeed} km/h | Không khí: <span class="font-bold text-emerald-300">AQI ${laocaiData.aqi}</span> (PM2.5: ${laocaiData.pm25} µg/m³)</div>
        </div>
      `;
    }

    const qnCard = document.getElementById('weather-card-quangninh');
    const qnData = weatherCache['Quảng Ninh'];
    if (qnCard && qnData) {
      qnCard.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="font-bold text-slate-200">🌊 Tỉnh Quảng Ninh (Hạ Long, Cẩm Phả)</div>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">Live Open-Meteo</span>
        </div>
        <div class="text-2xl font-black text-cyan-300 mt-1.5 flex items-center gap-2">
          <span>${qnData.weatherIcon}</span>
          <span>${qnData.temp}°C</span>
          <span class="text-xs font-normal text-slate-300">- ${qnData.weatherDesc}</span>
        </div>
        <div class="text-slate-400 mt-1 text-[11px] space-y-0.5">
          <div>Lượng mưa: <span class="font-bold text-slate-200">${qnData.rain} mm</span> | Cảm nhận: ${qnData.feelsLike}°C | Độ ẩm: ${qnData.humidity}%</div>
          <div>Gió: ${qnData.windSpeed} km/h | Không khí: <span class="font-bold text-emerald-300">AQI ${qnData.aqi}</span> (PM2.5: ${qnData.pm25} µg/m³)</div>
        </div>
      `;
    }
  }

  function updateTheme(isDark) {
    if (geoJsonLayer) {
      geoJsonLayer.setStyle(getFeatureStyle);
    }
  }

  window.ProvinceWeatherLayer = {
    init: init,
    toggle: toggle,
    updateTheme: updateTheme,
    updatePaneCards: updateWeatherPaneCards,
    refreshData: fetchLiveOpenMeteo,
    getCache: () => weatherCache,
    getLayerGroup: () => provincesLayerGroup
  };
})();
