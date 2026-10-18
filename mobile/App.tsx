import { theme } from "./src/theme";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  ImageBackground,
  Image,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from "react-native";
import { Neighbourhood, NativeProfileButton } from "./src/Neighbourhood";
import { NativeCarpool } from "./src/Carpool";
import { NativeDailyHome } from "./src/DailyHome";
import { NativeCommunity } from "./src/Community";
import { BASE } from "./src/api";
import { StatusBar } from "expo-status-bar";
import { request, signIn, signOut, type Row } from "./src/api";
const rupees = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v / 100);
const time = (v: string) =>
  new Date(v).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const tabs = [
  ["home", "\u2302", "Daily"],
  ["services", "\u2301", "Services"],
  ["circle", "\u2667", "Community"],
  ["myproject", "\u25a6", "My Project"],
  ["myhome", "\u25cb", "My Home"],
];
const sectionLinks: Record<string, [string, string][]> = {
  home: [
    ["home", "Daily store"],
    ["shop", "Catalogue & orders"],
  ],
  circle: [
    ["circle", "Neighbours"],
    ["exchange", "Marketplace"],
    ["rides", "Carpool"],
    ["community", "Events"],
    ["projects", "Our projects"],
  ],
  myhome: [
    ["myhome", "Home tools"],
    ["profile", "Profile & settings"],
  ],
};
const navGroup = (tab: string) =>
  ["home", "shop"].includes(tab)
    ? "home"
    : ["circle", "exchange", "rides", "community", "projects"].includes(tab)
      ? "circle"
      : ["myhome", "profile"].includes(tab)
        ? "myhome"
        : tab;
function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Input({
  label,
  value,
  onChange,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        style={styles.input}
      />
    </View>
  );
}
export default function App() {
  const screenScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [data, setData] = useState<Row | null>(null),
    [tab, setTab] = useState("home"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [slot, setSlot] = useState(""),
    [key, setKey] = useState(""),
    [query, setQuery] = useState(""),
    [showPlanned, setShowPlanned] = useState(false),
    [details, setDetails] = useState(""),
    [amount, setAmount] = useState(""),
    [emi, setEmi] = useState<Row | null>(null),
    [principal, setPrincipal] = useState("3500000"),
    [rate, setRate] = useState("8.5"),
    [months, setMonths] = useState("240");
  const activeGroup = navGroup(tab);
  const currentSections = sectionLinks[activeGroup] || [];
  const load = async () => {
    const d = await request("bootstrap");
    setData(d);
    setSlot((v) => v || d.slots.find((s: Row) => s.remaining > 0)?.id || "");
  };
  useEffect(() => {
    load().catch(() =>
      setError("Start the local server, then open the resident demo."),
    );
  }, []);
  useEffect(() => {
    screenScroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);
  async function act(fn: () => Promise<any>, message?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      await load();
      if (message) Alert.alert("MD One", message);
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const add = (pid: string, delta: number) => {
    setCart((c) => ({
      ...c,
      [pid]: Math.max(
        0,
        Math.min(
          20,
          data?.products.find((p: Row) => p.id === pid)?.stock || 0,
          (c[pid] || 0) + delta,
        ),
      ),
    }));
    if (!key) setKey(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  };
  const total =
      data?.products.reduce(
        (n: number, p: Row) => n + p.price * (cart[p.id] || 0),
        0,
      ) || 0,
    count = Object.values(cart).reduce((a, b) => a + b, 0),
    fee = total >= 29900 ? 0 : 2000;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.demo}>
          <Text style={styles.demoText}>
            LOCAL DEMO · SYNTHETIC RESIDENT DATA
          </Text>
        </View>
        <View style={styles.header}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              flex: 1,
            }}
          >
            <View style={{ alignItems: "center", gap: 5 }} accessibilityLabel="My Dream Projects — MD One">
              <Text style={{ color: "#b3b3b3", fontSize: 7, fontWeight: "600", letterSpacing: 1.2, lineHeight: 10 }}>
                MY DREAM PROJECTS
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Image source={require("./assets/mdp-icon.png")} accessibilityLabel="My Dream Projects original logo" style={{ width: 23, height: 26 }} resizeMode="contain" />
                <Text style={{ color: "#f5f3ed", fontSize: 24, fontWeight: "600", lineHeight: 28, letterSpacing: -0.8 }}>MD One</Text>
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile and privacy"
            onPress={() => setTab("profile")}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
          </Pressable>
        </View>
        {!data ? (
          <View style={styles.loading}>
            <Text style={styles.heading}>Welcome to your little corner.</Text>
            <Text style={styles.body}>
              A private home for your everyday life. Demo sign-in is for local
              simulators only.
            </Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Action
              label={busy ? "Opening…" : "Explore resident demo"}
              disabled={busy}
              onPress={() =>
                act(async () => {
                  await signIn();
                }, "Welcome home")
              }
            />
          </View>
        ) : (
          <>
            <ScrollView
              ref={screenScroll}
              contentContainerStyle={styles.content}
              refreshControl={
                <RefreshControl refreshing={busy} onRefresh={() => act(load)} />
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.location}>
                ⌖ {data.active?.project || "Membership pending"} ·{" "}
                {data.active?.label}
              </Text>
              {currentSections.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 22 }}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {currentSections.map(([id, label]) => (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: tab === id }}
                      onPress={() => setTab(id)}
                      style={{
                        paddingHorizontal: 13,
                        paddingVertical: 12,
                        minHeight: 44,
                        borderRadius: 8,
                        backgroundColor:
                          tab === id ? theme.selected : "transparent",
                        borderWidth: 1,
                        borderColor: tab === id ? theme.border : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: tab === id ? theme.text : theme.secondary,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {!!error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              )}
              {busy && <ActivityIndicator color="#3a3a3a" />}
              {["projects", "circle", "services"].includes(tab) &&
                data.social && (
                  <Neighbourhood
                    data={data}
                    act={act}
                    busy={busy}
                    view={tab}
                    go={setTab}
                  />
                )}
              {["myproject", "exchange"].includes(tab) && (
                <NativeCommunity
                  key={data.user.id + tab}
                  data={data}
                  view={tab}
                />
              )}
              {tab === "home" && (
                <NativeDailyHome
                  data={data}
                  cart={cart}
                  add={add}
                  go={setTab}
                />
              )}
              {tab === "shop" && (
                <>
                  <Text style={styles.eyebrow}>
                    FRESH FINDS, FAMILIAR SERVICE
                  </Text>
                  <Text style={styles.heading}>The daily basket.</Text>
                  <Input
                    label="Find an essential"
                    value={query}
                    onChange={setQuery}
                  />
                  <Action
                    label={
                      showPlanned
                        ? "Show stocked items"
                        : "Explore proposed range (not yet available)"
                    }
                    secondary
                    onPress={() => setShowPlanned(!showPlanned)}
                  />
                  {data.products
                    .filter(
                      (p: Row) =>
                        (showPlanned || p.stock > 0) &&
                        p.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((p: Row) => (
                      <View key={p.id} style={styles.row}>
                        <Text style={styles.emoji}>{p.emoji}</Text>
                        <View style={styles.grow}>
                          <Text style={styles.bold}>{p.name}</Text>
                          <Text style={styles.small}>
                            {p.unit} · {rupees(p.price)}
                            {p.launch_state === "planned"
                              ? " · Proposed, indicative price"
                              : ""}
                          </Text>
                        </View>
                        {cart[p.id] > 0 && (
                          <Action
                            label="−"
                            secondary
                            onPress={() => add(p.id, -1)}
                          />
                        )}
                        <Action
                          label={
                            p.launch_state === "planned"
                              ? "Planned"
                              : cart[p.id]
                                ? `${cart[p.id]} +`
                                : "Add +"
                          }
                          secondary
                          disabled={!data.services?.groceries || !p.stock}
                          onPress={() => add(p.id, 1)}
                        />
                      </View>
                    ))}
                  {count > 0 && (
                    <View style={styles.panel}>
                      <Text style={styles.sectionTitle}>
                        Your basket · {count} items
                      </Text>
                      <Text style={styles.body}>
                        {rupees(total)} items + {rupees(fee)} delivery
                      </Text>
                      <Text style={styles.label}>Delivery window · IST</Text>
                      {data.slots.map((s: Row) => (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: slot === s.id }}
                          disabled={!s.remaining}
                          key={s.id}
                          style={[
                            styles.slot,
                            slot === s.id && styles.slotSelected,
                          ]}
                          onPress={() => setSlot(s.id)}
                        >
                          <Text style={styles.body}>
                            {slot === s.id ? "◉" : "○"} {time(s.id)} ·{" "}
                            {s.remaining} remaining
                          </Text>
                        </Pressable>
                      ))}
                      <Text style={styles.note}>
                        No substitutions without confirmation. Demo COD only; no
                        payment is charged.
                      </Text>
                      <Action
                        label={`Place demo order · ${rupees(total + fee)}`}
                        disabled={busy || !slot}
                        onPress={async () => {
                          const r = await act(
                            () =>
                              request("orders", "POST", {
                                flatId: data.active.flat_id,
                                key,
                                items: data.products
                                  .filter((p: Row) => cart[p.id])
                                  .map((p: Row) => ({
                                    id: p.id,
                                    qty: cart[p.id],
                                  })),
                                payment: "cod",
                                substitution: "none",
                                slot,
                              }),
                            "Your demo basket is on its way to the warehouse",
                          );
                          if (r) {
                            setCart({});
                            setKey("");
                          }
                        }}
                      />
                    </View>
                  )}
                  <Text style={styles.sectionTitle}>Your orders</Text>
                  {data.orders.map((o: Row) => (
                    <View style={styles.panel} key={o.id}>
                      <Text style={styles.bold}>
                        #{o.id.slice(0, 8)} · {rupees(o.total)}
                      </Text>
                      <Text style={styles.tag}>
                        {o.status.replaceAll("_", " ")}
                      </Text>
                      <Text style={styles.body}>{time(o.slot)} IST</Text>
                      {["placed", "picking"].includes(o.status) && (
                        <Action
                          secondary
                          label="Cancel order"
                          onPress={() =>
                            act(
                              () =>
                                request(`orders/${o.id}`, "PATCH", {
                                  status: "cancelled",
                                }),
                              "Order cancelled",
                            )
                          }
                        />
                      )}
                    </View>
                  ))}
                </>
              )}
              {tab === "rides" && (
                <NativeCarpool
                  data={data}
                  act={act}
                  busy={busy}
                  styles={styles}
                />
              )}
              {tab === "community" && (
                <>
                  <Text style={styles.eyebrow}>
                    THE BEST PART OF HOME IS THE PEOPLE
                  </Text>
                  <Text style={styles.heading}>Our kind of together.</Text>
                  {data.events.map((e: Row) => (
                    <View key={e.id} style={styles.panel}>
                      <Text style={styles.tag}>{e.category} · DEMO EVENT</Text>
                      <Text style={styles.sectionTitle}>{e.title}</Text>
                      <Text style={styles.body}>{e.description}</Text>
                      <Text style={styles.small}>
                        {time(e.starts)} IST · {e.place}
                      </Text>
                      <Action
                        label={
                          e.joined ? "✓ Joined · leave RSVP" : "Count me in ↗"
                        }
                        secondary={!!e.joined}
                        disabled={busy}
                        onPress={() =>
                          act(
                            () =>
                              request(`events/${e.id}`, "POST", {
                                cancel: !!e.joined,
                              }),
                            e.joined ? "RSVP removed" : "You’re on the list",
                          )
                        }
                      />
                    </View>
                  ))}
                  <Text style={styles.sectionTitle}>
                    The neighbourhood board
                  </Text>
                  {data.posts.map((p: Row) => (
                    <View key={p.id} style={styles.panel}>
                      <Text style={styles.bold}>{p.name}</Text>
                      <Text style={styles.body}>{p.body}</Text>
                    </View>
                  ))}
                  <Input
                    label="A note for your neighbours"
                    value={details}
                    onChange={setDetails}
                  />
                  <Action
                    label="Share with the community"
                    disabled={busy || !details.trim()}
                    onPress={async () => {
                      const r = await act(
                        () => request("posts", "POST", { body: details }),
                        "Shared",
                      );
                      if (r) setDetails("");
                    }}
                  />
                </>
              )}
              {tab === "myhome" && (
                <>
                  <Text style={styles.eyebrow}>A PLACE FOR WHAT MATTERS</Text>
                  <Text style={styles.heading}>Your home, organised.</Text>
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>
                      The private everyday ledger
                    </Text>
                    <Input
                      label="What was it for?"
                      value={details}
                      onChange={setDetails}
                    />
                    <Input
                      label="Amount (₹)"
                      value={amount}
                      onChange={setAmount}
                      numeric
                    />
                    <Action
                      label="Save a private expense"
                      disabled={busy || !details || !Number(amount)}
                      onPress={async () => {
                        const r = await act(
                          () =>
                            request("expenses", "POST", {
                              description: details,
                              category: "Other",
                              amount: Math.round(Number(amount) * 100),
                              kind: "expense",
                              date: new Date().toISOString().slice(0, 10),
                            }),
                          "Saved privately",
                        );
                        if (r) {
                          setDetails("");
                          setAmount("");
                        }
                      }}
                    />
                    {data.expenses.slice(0, 5).map((e: Row) => (
                      <View key={e.id} style={styles.row}>
                        <Text style={[styles.body, styles.grow]}>
                          {e.description}
                        </Text>
                        <Text style={styles.bold}>{rupees(e.amount)}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>
                      A clearer picture of your EMI
                    </Text>
                    <Input
                      label="Principal (₹)"
                      value={principal}
                      onChange={setPrincipal}
                      numeric
                    />
                    <Input
                      label="Annual interest (%)"
                      value={rate}
                      onChange={setRate}
                      numeric
                    />
                    <Input
                      label="Tenure (months)"
                      value={months}
                      onChange={setMonths}
                      numeric
                    />
                    <Action
                      label="Calculate EMI"
                      disabled={busy}
                      onPress={async () => {
                        const r = await act(() =>
                          request("emi", "POST", {
                            principal: Number(principal),
                            rate: Number(rate),
                            months: Number(months),
                          }),
                        );
                        if (r) setEmi(r);
                      }}
                    />
                    {emi && (
                      <>
                        <Text style={styles.result}>
                          {rupees(Math.round(emi.emi * 100))}
                          <Text style={styles.small}> / month</Text>
                        </Text>
                        <Text style={styles.body}>
                          Total interest{" "}
                          {rupees(Math.round(emi.totalInterest * 100))}
                        </Text>
                        <Text style={styles.note}>{emi.assumption}</Text>
                      </>
                    )}
                  </View>
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>My documents</Text>
                    <Text style={styles.note}>
                      Encrypted local demo vault. Use synthetic files only.
                      Upload, download, and sharing controls are available in
                      the web interface.
                    </Text>
                    {data.documents.map((d: Row) => (
                      <View key={d.id} style={styles.row}>
                        <Text style={[styles.body, styles.grow]}>{d.name}</Text>
                        <Text style={styles.tag}>{d.status}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>
                      Your community & specialists
                    </Text>
                    <Action
                      label="Ask my project committee"
                      onPress={() => setTab("myproject")}
                    />
                    <Action
                      label="Request an MDP specialist"
                      onPress={() => setTab("services")}
                    />
                    {data.tickets.map((t: Row) => (
                      <Text key={t.id} style={styles.body}>
                        Previous request: {t.description} · {t.status}
                      </Text>
                    ))}
                  </View>
                </>
              )}
              {tab === "profile" && (
                <>
                  {data.social && (
                    <NativeProfileButton data={data} act={act} busy={busy} />
                  )}
                  <Text style={styles.eyebrow}>YOUR SPACE, YOUR CHOICES</Text>
                  <Text style={styles.heading}>{data.user.name}</Text>
                  <Text style={styles.body}>
                    Verified demo resident · {data.active?.project}
                  </Text>
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>Private by default.</Text>
                    <Text style={styles.body}>
                      Your personal documents and finances are private to your
                      account. Owners and association managers cannot
                      automatically see them.
                    </Text>
                    <Text style={styles.note}>
                      Production OTP, payments, notifications, and real service
                      coverage are not connected. Full privacy, export and
                      deletion controls are available in the local web
                      dashboard.
                    </Text>
                    <Action
                      label={
                        data.preferences.network
                          ? "Leave wider MDP events network"
                          : "Join wider MDP events network"
                      }
                      secondary
                      onPress={() =>
                        act(
                          () =>
                            request("preferences", "POST", {
                              ...data.preferences,
                              network: !data.preferences.network,
                            }),
                          "Preference saved",
                        )
                      }
                    />
                    <Action
                      label="Sign out"
                      secondary
                      onPress={async () => {
                        await signOut();
                        setData(null);
                      }}
                    />
                  </View>
                </>
              )}
              <Text style={styles.footer}>
                YOU DREAM. WE BUILD.{`\n`}MY DREAM PROJECTS® · AMEENPUR
              </Text>
            </ScrollView>
            <View style={styles.nav}>
              {tabs.map(([k, icon, label]) => (
                <Pressable
                  key={k}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeGroup === k }}
                  onPress={() => {
                    setTab(k);
                    screenScroll.current?.scrollTo({ y: 0, animated: false });
                    setDetails("");
                  }}
                  style={styles.navItem}
                >
                  <Text
                    style={[styles.navIcon, activeGroup === k && styles.active]}
                  >
                    {icon}
                  </Text>
                  <Text
                    style={[
                      styles.navLabel,
                      activeGroup === k && styles.active,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  demo: { backgroundColor: "#242424", paddingVertical: 7 },
  demoText: {
    fontSize: 8,
    letterSpacing: 1.5,
    textAlign: "center",
    color: "#f3f3f1",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    borderBottomWidth: 1,

    backgroundColor: theme.background,
    borderColor: theme.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  logo: {
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -1.4,
    color: "#f3f3f1",
  },
  gold: { color: "#e85d22" },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3a3a3a",
  },
  avatarText: { color: "#f3f3f1" },
  content: {
    padding: 18,
    paddingBottom: 35,
  },
  location: { fontSize: 10, color: "#f3f3f1", marginBottom: 28 },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.8,
    color: "#f3f3f1",
    marginBottom: 10,
  },
  heading: {
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -1.3,
    color: "#f3f3f1",
    lineHeight: 40,
    marginBottom: 13,
  },
  body: {
    marginBottom: 10,
    color: theme.secondary,
    fontSize: 13,
    lineHeight: 23,
  },
  hero: {
    backgroundColor: "#242424",
    borderRadius: 17,
    padding: 26,
    marginTop: 24,
    marginBottom: 20,
  },
  heroLabel: {
    fontSize: 7,
    letterSpacing: 1.5,
    color: "#f3f3f1",
    marginBottom: 20,
  },
  heroHeading: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "400",
    letterSpacing: -1.1,
    color: "#f3f3f1",
    marginBottom: 15,
  },
  heroBody: {
    fontSize: 11,
    color: "#f3f3f1",
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#f3f3f1",
    paddingHorizontal: 15,
    paddingVertical: 12,

    marginVertical: 5,
    alignItems: "center",

    minHeight: theme.touchTarget,
    borderRadius: theme.controlRadius,
  },
  buttonText: { color: "#242424", fontSize: 11, fontWeight: "600" },
  secondary: {
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  secondaryText: { color: "#f3f3f1" },
  disabled: { opacity: 0.4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  quick: {
    width: "47.7%",
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 11,
    padding: 17,
  },
  quickIcon: { fontSize: 25, color: "#f3f3f1", marginBottom: 10 },
  quickText: { fontSize: 11, fontWeight: "600", color: "#f3f3f1" },
  sectionTitle: {
    fontSize: 20,
    color: "#f3f3f1",
    fontWeight: "500",
    letterSpacing: -0.5,
    marginVertical: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#3a3a3a",
  },
  emoji: { fontSize: 32 },
  grow: { flex: 1 },
  bold: { fontSize: 11, fontWeight: "600", color: "#f3f3f1" },
  small: { fontSize: 9, color: "#f3f3f1", lineHeight: 18 },
  note: {
    lineHeight: 19,
    marginVertical: 16,
    color: theme.secondary,
    fontSize: 11,
  },
  panel: {
    padding: 22,
    borderWidth: 1,

    marginVertical: 10,

    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: theme.radius,
  },
  tag: {
    alignSelf: "flex-start",
    fontSize: 8,
    color: "#f3f3f1",
    backgroundColor: "#242424",
    padding: 6,
    borderRadius: 5,
    marginVertical: 10,
    textTransform: "uppercase",
  },
  field: { marginVertical: 9 },
  label: { fontSize: 10, color: "#f3f3f1", marginBottom: 7 },
  input: {
    padding: 13,
    borderWidth: 1,

    fontSize: 13,
    color: "#f3f3f1",

    backgroundColor: theme.background,
    borderColor: theme.border,
    borderRadius: theme.controlRadius,
    minHeight: theme.touchTarget,
  },
  slot: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 7,
    marginVertical: 4,
  },
  slotSelected: { borderColor: "#e85d22", backgroundColor: "#242424" },
  result: { fontSize: 33, color: "#f3f3f1", marginTop: 25 },
  footer: {
    textAlign: "center",
    fontSize: 7,
    letterSpacing: 1.7,
    lineHeight: 18,
    color: "#f3f3f1",
    marginTop: 40,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderColor: "#3a3a3a",
    paddingVertical: 12,
    backgroundColor: "#242424",
  },
  navItem: { alignItems: "center", gap: 4 },
  navIcon: { fontSize: 23, color: "#f3f3f1" },
  navLabel: { fontSize: 8, color: "#f3f3f1" },
  active: { color: "#f3f3f1" },
  loading: { flex: 1, justifyContent: "center", padding: 30 },
  error: {
    fontSize: 12,
    color: "#f3f3f1",
    backgroundColor: "#3a3a3a",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
});
