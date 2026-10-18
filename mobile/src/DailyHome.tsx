import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Image,
  ImageBackground,
  ScrollView,
} from "react-native";
import type { Row } from "./api";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
const tileMap: Record<string, number> = {
  milk: 0,
  eggs: 1,
  banana: 2,
  tomato: 3,
  bread: 4,
  onion: 5,
  rice: 6,
  apple: 7,
  curd: 8,
  spinach: 9,
  soap: 10,
  cleaner: 11,
  snacks: 12,
  tea: 13,
};
function Photo({ id, size }: { id: string; size: number }) {
  const tile = tileMap[id];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#e9e6df",
      }}
    >
      {tile === undefined ? (
        <Text style={{ color: "#606060", padding: 12, fontSize: 10 }}>
          Image coming soon
        </Text>
      ) : (
        <Image
          accessibilityLabel="Illustrative product photo"
          source={require("../assets/grocery/product-sheet.png")}
          style={{
            position: "absolute",
            width: size * 4,
            height: size * 4,
            left: -(tile % 4) * size,
            top: -Math.floor(tile / 4) * size,
          }}
        />
      )}
    </View>
  );
}
const groups = [
  ["All", "All", "milk"],
  ["Dairy & eggs", "Milk & eggs", "milk"],
  ["Rice, atta & dals", "Staples", "rice"],
  ["Vegetables & fruit", "Fruit & veg", "tomato"],
  ["Breakfast, snacks & drinks", "Breakfast", "bread"],
  ["Home & personal care", "Home care", "soap"],
  ["Oils, ghee & masalas", "Oils & masalas", "cleaner"],
];
export function NativeDailyHome({
  data,
  cart,
  add,
  go,
}: {
  data: Row;
  cart: Record<string, number>;
  add: (pid: string, n: number) => void;
  go: (tab: string) => void;
}) {
  const [category, setCategory] = useState("All"),
    [query, setQuery] = useState(""),
    [width, setWidth] = useState(330);
  const products = data.products.filter(
    (p: Row) =>
      p.stock > 0 &&
      p.launch_state !== "planned" &&
      (category === "All" || p.category === category) &&
      `${p.name} ${p.category}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const slot = data.slots?.find((s: Row) => s.remaining > 0);
  const previous = new Set(
    (data.orders || [])
      .filter((o: Row) => o.status === "delivered")
      .flatMap((o: Row) => o.items.map((i: Row) => i.name)),
  );
  const again = products.filter((p: Row) => previous.has(p.name)).slice(0, 2);
  const card = (p: Row) => (
    <View key={p.id} style={[s.card, { width: (width - 14) / 2 }]}>
      <Photo id={p.id} size={(width - 14) / 2} />
      <Text style={s.unit}>{p.unit}</Text>
      <Text style={s.name}>{p.name}</Text>
      <View style={s.priceRow}>
        <Text style={s.price}>{money(p.price)}</Text>
        <View style={s.stepper}>
          {cart[p.id] > 0 && (
            <Pressable
              accessibilityLabel={`Remove one ${p.name}`}
              onPress={() => add(p.id, -1)}
              style={s.stepButton}
            >
              <Text style={s.stepText}>−</Text>
            </Pressable>
          )}
          {cart[p.id] > 0 && <Text style={s.stepText}>{cart[p.id]}</Text>}
          <Pressable
            style={[
              s.stepButton,
              {
                opacity:
                  !data.services?.groceries ||
                  (cart[p.id] || 0) >= Math.min(20, p.stock)
                    ? 0.5
                    : 1,
              },
            ]}
            disabled={
              !data.services?.groceries ||
              (cart[p.id] || 0) >= Math.min(20, p.stock)
            }
            accessibilityLabel={`Add ${p.name}`}
            onPress={() => add(p.id, 1)}
          >
            <Text style={s.stepText}>{cart[p.id] ? "+" : "ADD +"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
  return (
    <View style={s.page} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={s.titleRow}>
        <View>
          <Text style={s.caption}>Your neighbourhood, delivered.</Text>
          <Text style={s.title}>
            Everyday, made easy<Text style={{ color: "#e85d22" }}>.</Text>
          </Text>
        </View>
      </View>
      <TextInput
        accessibilityLabel="Search daily essentials"
        style={s.search}
        value={query}
        onChangeText={setQuery}
        placeholder="What does home need today?"
        placeholderTextColor="#99989c"
      />
      <View style={s.availability}>
        <Text style={s.small}>
          {data.services?.groceries
            ? "● Delivery to your community"
            : "Delivery not enabled here"}
        </Text>
        <Pressable onPress={() => go("shop")}>
          <Text style={s.small}>
            {slot && data.services?.groceries
              ? new Date(slot.id).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "numeric",
                  minute: "2-digit",
                }) + " IST ↗"
              : "View catalogue ↗"}
          </Text>
        </Pressable>
      </View>
      {!query && category === "All" && (
        <ImageBackground
          source={require("../assets/grocery/everyday-table.png")}
          style={s.editorial}
          imageStyle={{ borderRadius: 14 }}
        >
          <View style={s.editorialShade}>
            <Text style={s.editorialLabel}>The morning edit</Text>
            <Text style={s.editorialTitle}>
              A good day starts{`\n`}with the little things.
            </Text>
            <Text style={s.editorialBody}>
              Your everyday essentials,{`\n`}closer to home.
            </Text>
            <Pressable
              style={s.primary}
              onPress={() => setCategory("Dairy & eggs")}
            >
              <Text style={s.primaryText}>Shop breakfast →</Text>
            </Pressable>
          </View>
        </ImageBackground>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categories}
      >
        {groups.map(([id, label, photo]) => (
          <Pressable
            key={id}
            accessibilityState={{ selected: category === id }}
            onPress={() => setCategory(id)}
            style={s.category}
          >
            <View style={category === id ? s.categorySelected : undefined}>
              <Photo id={photo} size={62} />
            </View>
            <Text style={s.categoryLabel}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {!query && category === "All" && again.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Your usuals, ready again.</Text>
          <View style={s.grid}>{again.map(card)}</View>
        </>
      )}
      <View style={s.titleRow}>
        <Text style={s.sectionTitle}>
          {query
            ? "Search results"
            : category === "All"
              ? "Everyday essentials"
              : category}
        </Text>
        <Pressable onPress={() => go("shop")}>
          <Text style={s.small}>All products ↗</Text>
        </Pressable>
      </View>
      <View style={s.grid}>{products.map(card)}</View>
      {!products.length && (
        <View style={s.empty}>
          <Text style={s.name}>No products on this shelf.</Text>
          <Text style={s.small}>
            Try another search or browse the planned range in Shop.
          </Text>
          <Pressable
            onPress={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            <Text style={s.price}>Clear filters →</Text>
          </Pressable>
        </View>
      )}
      <Text style={s.footnote}>
        Stock & slots confirmed at checkout. Images are illustrative.
      </Text>
      <Pressable style={s.primary} onPress={() => go("shop")}>
        <Text style={s.primaryText}>Basket, catalogue & my orders →</Text>
      </Pressable>
      <Text style={s.sectionTitle}>A little more connected.</Text>
      <View style={s.links}>
        {[
          ["services", "Home services"],
          ["circle", "Community"],
          ["myproject", "My Project"],
          ["rides", "Go together"],
          ["exchange", "Marketplace"],
          ["myhome", "Documents & home"],
          ["myhome", "Personal finances"],
          ["community", "Events"],
          ["projects", "Our 19 addresses"],
        ].map(([id, label]) => (
          <Pressable key={id} style={s.link} onPress={() => go(id)}>
            <Text style={s.name}>{label} ↗</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  page: { gap: 18 },
  caption: { color: "#b0afb1", fontSize: 11 },
  title: {
    fontSize: 27,
    fontWeight: "500",
    letterSpacing: -1.1,
    color: "#f5f3ed",
    marginTop: 7,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  search: {
    backgroundColor: "#151516",
    borderWidth: 1,
    borderColor: "#ffffff1c",
    borderRadius: 12,
    color: "#f5f3ed",
    fontSize: 13,
    minHeight: 50,
    paddingHorizontal: 15,
  },
  availability: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: -5,
  },
  small: { fontSize: 10, color: "#b0afb1", lineHeight: 17 },
  editorial: {
    height: 210,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1c1c1e",
  },
  editorialShade: {
    backgroundColor: "#0b0b0c90",
    height: "100%",
    padding: 18,
    alignItems: "flex-start",
  },
  editorialLabel: { fontSize: 10, color: "#ddd6ca" },
  editorialTitle: {
    fontSize: 25,
    lineHeight: 29,
    fontFamily: "Georgia",
    color: "#f5f3ed",
    marginTop: 10,
  },
  editorialBody: {
    fontSize: 11,
    color: "#d0cbc1",
    lineHeight: 17,
    marginTop: 9,
    marginBottom: 12,
  },
  primary: {
    backgroundColor: "#f5f3ed",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 42,
    justifyContent: "center",
  },
  primaryText: { fontSize: 11, fontWeight: "600", color: "#0b0b0c" },
  categories: { gap: 13, padding: 4 },
  category: { width: 68, gap: 9, alignItems: "center" },
  categoryLabel: { fontSize: 10, color: "#dedcda" },
  categorySelected: {
    borderWidth: 1,
    borderColor: "#e85d22",
    borderRadius: 14,
    padding: 2,
    margin: -3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "500",
    letterSpacing: -0.5,
    color: "#f5f3ed",
    flexShrink: 1,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, rowGap: 24 },
  card: { gap: 7 },
  unit: { fontSize: 10, color: "#b0afb1", marginTop: 5 },
  name: { fontSize: 12, lineHeight: 18, color: "#f5f3ed", minHeight: 34 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  price: { fontSize: 13, color: "#f5f3ed", fontWeight: "600" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffffff26",
    borderRadius: 8,
  },
  stepButton: {
    minWidth: 38,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  stepText: { color: "#f5f3ed", fontSize: 10, fontWeight: "600" },
  footnote: { color: "#89888b", fontSize: 9, lineHeight: 16 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  link: {
    padding: 14,
    backgroundColor: "#151516",
    borderWidth: 1,
    borderColor: "#ffffff14",
    borderRadius: 10,
    minWidth: "46%",
    flexGrow: 1,
  },
  empty: {
    padding: 25,
    borderWidth: 1,
    borderColor: "#ffffff1c",
    borderRadius: 12,
    gap: 10,
  },
});
