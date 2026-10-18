import { theme } from "./theme";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  Switch,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { request, BASE, type Row } from "./api";
type Props = {
  data: Row;
  busy: boolean;
  act: (fn: () => Promise<any>, message?: string) => Promise<any>;
  view: string;
};
const B = ({
  label,
  click,
  disabled = false,
}: {
  label: string;
  click: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={click}
    style={[s.button, disabled && { opacity: 0.4 }]}
  >
    <Text style={s.buttonText}>{label}</Text>
  </Pressable>
);
const Avatar = ({ p }: { p: Row }) =>
  p.avatar ? (
    <Image source={{ uri: p.avatar }} style={s.avatar} />
  ) : (
    <View style={s.avatar}>
      <Text style={s.initial}>{(p.name || "A")[0]}</Text>
    </View>
  );
const Field = ({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
}) => (
  <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      style={s.input}
      value={value}
      onChangeText={set}
    />
  </View>
);
async function pick() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.35,
    base64: true,
    exif: false,
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  if (!a.base64) return null;
  if (a.base64.length > 530000)
    throw new Error(
      "Please crop or choose a smaller photo. Limit is 400 KB after compression.",
    );
  return `data:image/jpeg;base64,${a.base64}`;
}
export function Neighbourhood({
  data,
  view,
  act,
  busy,
  go,
}: Props & { go: (tab: string) => void }) {
  const social = data.social;
  const [project, setProject] = useState<Row | null>(null),
    [filter, setFilter] = useState("all"),
    [profile, setProfile] = useState<string | null>(null),
    [mode, setMode] = useState("feed"),
    [body, setBody] = useState(""),
    [img, setImg] = useState(""),
    [visibility, setVisibility] = useState("project"),
    [service, setService] = useState<Row | null>(null),
    [description, setDescription] = useState(""),
    [preferred, setPreferred] = useState("Tomorrow afternoon");
  const open = async (id: string) => {
    const p = await act(() => request("projects/" + id));
    if (p) setProject(p);
  };
  return (
    <View>
      {view === "projects" && (
        <>
          <Text style={s.kicker}>19 ADDRESSES. ONE MDP.</Text>
          <Text style={s.heading}>A world of its own.</Text>
          {project ? (
            <>
              <B label="← All projects" click={() => setProject(null)} />
              <Image
                source={{ uri: BASE + project.image }}
                style={s.projectImage}
              />
              <Text style={s.heading}>{project.name}</Text>
              <Text style={s.meta}>
                {project.status === "ongoing" ? "TAKING SHAPE" : "COMPLETED"} ·{" "}
                {project.floors} · {project.totalFlats} residences
              </Text>
              <Text style={s.body}>
                {project.flatMix} ·{" "}
                {project.status === "ongoing" ? "Expected " : ""}
                {project.year}
              </Text>
              <Text style={s.note}>
                Official project metadata. Flat numbers and residents below are
                synthetic demo records, not the actual register.
              </Text>
              {project.flats.length ? (
                project.flats.map((f: Row) => (
                  <View key={f.id} style={s.panel}>
                    <Text style={s.title}>Flat {f.label}</Text>
                    {f.residents.map((p: Row) => (
                      <Pressable
                        accessibilityRole="button"
                        key={p.id}
                        style={s.person}
                        onPress={() => setProfile(p.id)}
                      >
                        <Avatar p={p} />
                        <View style={s.grow}>
                          <Text style={s.name}>{p.name}</Text>
                          <Text style={s.meta}>
                            {p.locked
                              ? "Locked profile"
                              : p.occupation || "MDP neighbour"}
                          </Text>
                        </View>
                        <Text style={s.arrow}>↗</Text>
                      </Pressable>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={s.note}>
                  No authorized flat register imported for this project.
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={s.pills}>
                {["all", "completed", "ongoing"].map((k) => (
                  <B
                    key={k}
                    label={
                      k === "all"
                        ? "All 19"
                        : k === "completed"
                          ? "Completed 13"
                          : "Ongoing 6"
                    }
                    click={() => setFilter(k)}
                  />
                ))}
              </View>
              {social.projects
                .filter((p: Row) => filter === "all" || p.status === filter)
                .map((p: Row) => (
                  <Pressable
                    accessibilityRole="button"
                    key={p.id}
                    style={s.projectCard}
                    onPress={() => open(p.id)}
                  >
                    <Image
                      source={{ uri: BASE + p.image }}
                      style={s.projectImage}
                    />
                    <View style={s.projectText}>
                      <Text style={s.meta}>
                        {p.status === "ongoing" ? "TAKING SHAPE" : "COMPLETED"}{" "}
                        · {p.status === "ongoing" ? "Expected " : ""}
                        {p.year}
                      </Text>
                      <Text style={s.title}>{p.name} ↗</Text>
                      <Text style={s.body}>
                        {p.floors} · {p.totalFlats} residences · {p.flatMix}
                      </Text>
                    </View>
                  </Pressable>
                ))}
            </>
          )}
        </>
      )}
      {view === "circle" && (
        <>
          <Text style={s.kicker}>THE PEOPLE MAKE THE PLACE.</Text>
          <Text style={s.heading}>Your community.</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
            {[
              {
                id: "exchange",
                title: "Marketplace",
                body: "Items and homes for rent or sale.",
                action: "Open marketplace ↗",
                light: true,
              },
              {
                id: "rides",
                title: "Carpool",
                body: "Meet neighbours going your way.",
                action: "Explore rides ↗",
                light: false,
              },
            ].map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => go(item.id)}
                style={{
                  flex: 1,
                  padding: 17,
                  minHeight: 204,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: item.light ? "#f5f3ed" : theme.surface,
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: item.id === "exchange" ? 22 : 25,
                    fontWeight: "600",
                    letterSpacing: -1,
                    color: item.light ? "#202022" : theme.text,
                  }}
                >
                  {item.title}
                  <Text style={{ color: theme.orange }}>.</Text>
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 20,
                    color: item.light ? "#626166" : theme.secondary,
                    marginVertical: 15,
                  }}
                >
                  {item.body}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: item.light ? "#202022" : theme.text,
                  }}
                >
                  {item.action}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.pills}>
            {["feed", "people", "friends"].map((k) => (
              <B
                key={k}
                label={
                  k === "feed"
                    ? "Moments"
                    : k === "people"
                      ? "Discover"
                      : "Connections"
                }
                click={() => setMode(k)}
              />
            ))}
          </View>
          {mode === "feed" ? (
            <>
              <View style={s.panel}>
                <Field
                  label="A moment from your world"
                  value={body}
                  set={setBody}
                />
                <View style={s.pills}>
                  {[
                    ["project", "My project"],
                    ["friends", "Friends"],
                    ["network", "All MDP"],
                  ].map(([v, l]) => (
                    <Pressable
                      key={v}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: visibility === v }}
                      onPress={() => setVisibility(v)}
                    >
                      <Text style={s.label}>
                        {visibility === v ? "◉" : "○"} {l}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {!!img && <Image source={{ uri: img }} style={s.postImage} />}
                <B
                  label={img ? "Change photo" : "Add photo"}
                  click={async () => {
                    try {
                      const p = await pick();
                      if (p) setImg(p);
                    } catch (e) {
                      Alert.alert("Photo", (e as Error).message);
                    }
                  }}
                />
                <B
                  label="Share your moment ↗"
                  disabled={busy || !body.trim()}
                  click={async () => {
                    const r = await act(
                      () =>
                        request("social-posts", "POST", {
                          body,
                          visibility,
                          image: img,
                        }),
                      "Moment shared",
                    );
                    if (r) {
                      setBody("");
                      setImg("");
                    }
                  }}
                />
              </View>
              {social.feed.map((p: Row) => (
                <View key={p.id} style={s.panel}>
                  <Pressable
                    style={s.person}
                    onPress={() => setProfile(p.user_id)}
                  >
                    <Avatar p={{ name: p.name, avatar: p.avatar }} />
                    <View>
                      <Text style={s.name}>{p.name}</Text>
                      <Text style={s.meta}>
                        {p.project} · {p.visibility}
                      </Text>
                    </View>
                  </Pressable>
                  <Text style={s.body}>{p.body}</Text>
                  {(p.image || p.post_kind === "architecture") && (
                    <Image
                      source={{
                        uri:
                          p.image || BASE + "/projects/my-dream-skylark.webp",
                      }}
                      style={s.postImage}
                    />
                  )}
                  <B
                    label={`${p.liked ? "♥" : "♡"} ${p.likes || "Like"}`}
                    disabled={busy}
                    click={() =>
                      act(
                        () =>
                          request("social-posts/" + p.id, "POST", {
                            action: "like",
                          }),
                        p.liked ? "Like removed" : "Liked",
                      )
                    }
                  />
                </View>
              ))}
            </>
          ) : mode === "people" ? (
            social.people
              .filter((p: Row) => p.id !== data.user.id)
              .map((p: Row) => (
                <Pressable
                  key={p.id}
                  style={s.personCard}
                  onPress={() => setProfile(p.id)}
                >
                  <Avatar p={p} />
                  <View style={s.grow}>
                    <Text style={s.name}>{p.name}</Text>
                    <Text style={s.meta}>
                      {p.project} · {p.flat}
                    </Text>
                    <Text style={s.body}>
                      {p.locked ? "◈ Profile locked" : p.occupation}
                    </Text>
                  </View>
                  <Text style={s.arrow}>↗</Text>
                </Pressable>
              ))
          ) : social.connections.length ? (
            social.connections.map((q: Row) => (
              <View key={q.id} style={s.panel}>
                <Pressable
                  style={s.person}
                  onPress={() => setProfile(q.other.id)}
                >
                  <Avatar p={q.other} />
                  <View>
                    <Text style={s.name}>{q.other.name}</Text>
                    <Text style={s.meta}>
                      {q.status === "accepted"
                        ? "Connected"
                        : q.recipient_id === data.user.id
                          ? "Incoming friend request"
                          : "Request sent"}
                    </Text>
                  </View>
                </Pressable>
                {q.status === "pending" && q.recipient_id === data.user.id ? (
                  <>
                    <B
                      label="Accept friend request"
                      disabled={busy}
                      click={() =>
                        act(
                          () =>
                            request("friends/" + q.other.id, "POST", {
                              action: "accept",
                            }),
                          "Connected",
                        )
                      }
                    />
                    <B
                      label="Decline"
                      disabled={busy}
                      click={() =>
                        act(
                          () =>
                            request("friends/" + q.other.id, "POST", {
                              action: "decline",
                            }),
                          "Request declined",
                        )
                      }
                    />
                  </>
                ) : (
                  <B
                    label={
                      q.status === "accepted"
                        ? "Remove friend"
                        : "Cancel request"
                    }
                    disabled={busy}
                    click={() =>
                      act(
                        () =>
                          request("friends/" + q.other.id, "POST", {
                            action:
                              q.status === "accepted" ? "remove" : "cancel",
                          }),
                        "Connection updated",
                      )
                    }
                  />
                )}
              </View>
            ))
          ) : (
            <Text style={s.note}>
              A first hello starts a connection. Discover a neighbour to send a
              request.
            </Text>
          )}
        </>
      )}
      {view === "services" && (
        <>
          <Text style={s.kicker}>YOUR BUILDER. STILL BY YOUR SIDE.</Text>
          <Text style={s.heading}>Consider it{`\n`}taken care of.</Text>
          <Text style={s.body}>
            Plumbing, electrical, tiles and more — coordinated by the MDP team.
          </Text>
          <View style={s.servicesGrid}>
            {social.services.map((c: Row) => (
              <Pressable
                key={c.id}
                style={s.serviceCard}
                onPress={() => setService(c)}
              >
                <Text style={s.serviceIcon}>
                  {
                    (
                      {
                        plumbing: "◉",
                        electrical: "ϟ",
                        tiles: "▦",
                        painting: "◐",
                        carpentry: "⌁",
                        cleaning: "✧",
                        waterproofing: "☂",
                        ac: "≋",
                      } as Row
                    )[c.id]
                  }
                </Text>
                <Text style={s.title}>{c.name}</Text>
                <Text style={s.body}>{c.description}</Text>
                <Text style={s.meta}>REQUEST A SPECIALIST ↗</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.note}>
            Demo only. No real specialist is dispatched. MDP confirms actual
            scope, availability and charges before work.
          </Text>
          <Text style={s.title}>Your service requests</Text>
          {social.requests.map((r: Row) => (
            <View style={s.panel} key={r.id}>
              <Text style={s.title}>{r.category}</Text>
              <Text style={s.meta}>
                {r.status.replaceAll("_", " ").toUpperCase()}
              </Text>
              <Text style={s.body}>{r.description}</Text>
              <Text style={s.body}>
                {r.technician || "Awaiting MDP assignment"}
              </Text>
              <Text style={s.note}>
                {r.project} · {r.label} · {r.preferred}
              </Text>
              {["requested", "assigned"].includes(r.status) && (
                <B
                  label="Cancel request"
                  disabled={busy}
                  click={() =>
                    act(
                      () =>
                        request("insta-services/" + r.id, "PATCH", {
                          status: "cancelled",
                        }),
                      "Request cancelled",
                    )
                  }
                />
              )}
            </View>
          ))}
        </>
      )}
      {profile && (
        <ProfileModal
          uid={profile}
          data={data}
          act={act}
          busy={busy}
          close={() => setProfile(null)}
        />
      )}
      {service && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setService(null)}
        >
          <View style={s.modalBackdrop}>
            <ScrollView contentContainerStyle={s.modalScroll}>
              <View style={s.modal}>
                <B label="Close ×" click={() => setService(null)} />
                <Text style={s.heading}>{service.name}, taken care of.</Text>
                <Text style={s.meta}>
                  {data.active.project} · {data.active.label}
                </Text>
                <Field
                  label="What work is needed?"
                  value={description}
                  set={setDescription}
                />
                <Field
                  label="Preferred visit"
                  value={preferred}
                  set={setPreferred}
                />
                <Text style={s.note}>
                  This is a request, not a confirmed arrival or emergency
                  dispatch.
                </Text>
                <B
                  label="Request an MDP specialist ↗"
                  disabled={busy || !description.trim()}
                  click={async () => {
                    const r = await act(
                      () =>
                        request("insta-services", "POST", {
                          flatId: data.active.flat_id,
                          categoryId: service.id,
                          description,
                          preferred,
                          urgency: "routine",
                        }),
                      "Request sent to the MDP service desk",
                    );
                    if (r) {
                      setService(null);
                      setDescription("");
                    }
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}
function ProfileModal({
  uid,
  data,
  act,
  busy,
  close,
}: { uid: string; close: () => void } & Omit<Props, "view">) {
  const [p, setP] = useState<Row | null>(null),
    [editing, setEditing] = useState(false),
    [bio, setBio] = useState(""),
    [occupation, setOccupation] = useState(""),
    [contact, setContact] = useState(""),
    [contactVisibility, setContactVisibility] = useState("friends"),
    [avatar, setAvatar] = useState(""),
    [locked, setLocked] = useState(true),
    [discover, setDiscover] = useState(false),
    [network, setNetwork] = useState(false),
    [err, setErr] = useState("");
  const own = uid === data.user.id;
  useEffect(() => {
    request("profiles/" + uid)
      .then((r) => {
        setP(r);
        setBio(r.bio || "");
        setOccupation(r.occupation || "");
        setContact(r.contact || "");
        setContactVisibility(r.contactVisibility || "friends");
        setAvatar(r.avatar || "");
        setLocked(!!r.locked);
        setDiscover(!!r.discoverable);
        setNetwork(!!r.networkVisible);
      })
      .catch((e) => setErr(e.message));
  }, [uid, data]);
  return (
    <Modal transparent animationType="slide" onRequestClose={close}>
      <View style={s.modalBackdrop}>
        <ScrollView contentContainerStyle={s.modalScroll}>
          <View style={s.modal}>
            <B label="Close ×" click={close} />
            {err ? (
              <Text style={s.note}>{err}</Text>
            ) : (
              p && (
                <>
                  <Avatar p={{ ...p, avatar: editing ? avatar : p.avatar }} />
                  <Text style={s.heading}>{p.name}</Text>
                  <Text style={s.meta}>
                    {p.project} · {p.flat}
                  </Text>
                  {editing ? (
                    <>
                      <B
                        label="Upload your picture"
                        click={async () => {
                          try {
                            const image = await pick();
                            if (image) setAvatar(image);
                          } catch (e) {
                            Alert.alert("Photo", (e as Error).message);
                          }
                        }}
                      />
                      <Field label="Bio" value={bio} set={setBio} />
                      <Field
                        label="Occupation"
                        value={occupation}
                        set={setOccupation}
                      />
                      <Field
                        label="Contact (optional)"
                        value={contact}
                        set={setContact}
                      />
                      <Text style={s.label}>Contact visibility</Text>
                      <View style={s.pills}>
                        {["private", "friends", "community"].map((v) => (
                          <Pressable
                            key={v}
                            onPress={() => setContactVisibility(v)}
                          >
                            <Text style={s.meta}>
                              {contactVisibility === v ? "◉" : "○"} {v}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {[
                        ["Lock my profile", locked, setLocked],
                        [
                          "Show me in the resident directory",
                          discover,
                          setDiscover,
                        ],
                        ["Connect across MDP projects", network, setNetwork],
                      ].map(([l, v, fn]: any) => (
                        <View key={l} style={s.switchRow}>
                          <Text style={[s.body, s.grow]}>{l}</Text>
                          <Switch
                            value={v}
                            onValueChange={fn}
                            trackColor={{ false: "#3a3a3a", true: "#b3b3b3" }}
                          />
                        </View>
                      ))}
                      <B
                        label="Save profile & privacy"
                        disabled={busy}
                        click={async () => {
                          const r = await act(
                            () =>
                              request("my-profile", "POST", {
                                bio,
                                occupation,
                                contact,
                                contactVisibility,
                                avatar,
                                locked,
                                discoverable: discover,
                                networkVisible: network,
                              }),
                            "Profile updated",
                          );
                          if (r) setEditing(false);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      {p.canSeeDetails ? (
                        <>
                          <Text style={s.body}>{p.bio}</Text>
                          <Text style={s.body}>
                            {p.occupation || "Occupation not added"}
                          </Text>
                          <Text style={s.body}>
                            {p.contact || "Contact details are private"}
                          </Text>
                        </>
                      ) : (
                        <View style={s.panel}>
                          <Text style={s.title}>◈ This profile is locked.</Text>
                          <Text style={s.body}>
                            Connect as friends to see their photo, occupation,
                            contact preferences and posts.
                          </Text>
                        </View>
                      )}
                      {own ? (
                        <B
                          label="Edit profile & privacy"
                          click={() => setEditing(true)}
                        />
                      ) : (
                        <B
                          label={
                            p.relationship === "friends"
                              ? "✓ Friends · remove"
                              : p.relationship === "outgoing"
                                ? "Request sent · cancel"
                                : p.relationship === "incoming"
                                  ? "Accept friend request"
                                  : "Add friend +"
                          }
                          disabled={busy}
                          click={() =>
                            act(
                              () =>
                                request("friends/" + p.id, "POST", {
                                  action:
                                    p.relationship === "friends"
                                      ? "remove"
                                      : p.relationship === "outgoing"
                                        ? "cancel"
                                        : p.relationship === "incoming"
                                          ? "accept"
                                          : "request",
                                }),
                              "Connection updated",
                            )
                          }
                        />
                      )}
                    </>
                  )}
                </>
              )
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
export function NativeProfileButton({ data, act, busy }: Omit<Props, "view">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <B label="My social profile & privacy ↗" click={() => setOpen(true)} />
      {open && (
        <ProfileModal
          uid={data.user.id}
          data={data}
          act={act}
          busy={busy}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}
const s = StyleSheet.create({
  kicker: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: "#f3f3f1",
    marginBottom: 12,
  },
  heading: {
    fontSize: 32,
    fontWeight: "400",
    letterSpacing: -1.3,
    lineHeight: 39,
    color: "#f3f3f1",
    marginBottom: 18,
  },
  body: {
    marginVertical: 7,
    color: theme.secondary,
    fontSize: 13,
    lineHeight: 23,
  },
  meta: {
    lineHeight: 17,
    letterSpacing: 0.5,
    color: theme.secondary,
    fontSize: 10,
  },
  note: {
    lineHeight: 20,
    marginVertical: 18,
    color: theme.secondary,
    fontSize: 11,
  },
  title: {
    fontSize: 21,
    fontWeight: "400",
    letterSpacing: -0.7,
    color: "#f3f3f1",
    marginVertical: 10,
  },
  name: { fontSize: 13, fontWeight: "500", color: "#f3f3f1", marginBottom: 4 },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 11,

    marginVertical: 6,
    alignItems: "center",

    minHeight: theme.touchTarget,
    borderRadius: theme.controlRadius,
    backgroundColor: theme.selected,
  },
  buttonText: { color: "#f3f3f1", fontWeight: "600", fontSize: 12 },
  pills: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginVertical: 14,
    alignItems: "center",
  },
  panel: {
    borderWidth: 1,

    padding: 20,
    marginVertical: 10,

    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: theme.radius,
  },
  personCard: {
    borderWidth: 1,

    padding: 17,
    marginVertical: 8,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",

    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: theme.radius,
  },
  person: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginVertical: 10,
  },
  avatar: {
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: "#3a3a3a",
    borderWidth: 1,
    borderColor: "#b3b3b3",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 22, color: "#f3f3f1" },
  grow: { flex: 1 },
  arrow: { color: "#f3f3f1", fontSize: 24 },
  projectCard: {
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#242424",
    marginVertical: 12,
  },
  projectImage: {
    height: 270,
    width: "100%",
    resizeMode: "cover",
    backgroundColor: "#242424",
  },
  projectText: { padding: 20 },
  postImage: {
    width: "100%",
    height: 260,
    resizeMode: "cover",
    borderRadius: 9,
    marginVertical: 14,
  },
  input: {
    backgroundColor: "#121212",
    borderColor: "#3a3a3a",
    borderWidth: 1,
    borderRadius: 7,
    color: "#f3f3f1",
    fontSize: 12,
    padding: 13,
  },
  field: { marginVertical: 12 },
  label: { fontSize: 10, color: "#f3f3f1", marginBottom: 9 },
  modalBackdrop: { flex: 1, backgroundColor: "#0a0a0adb" },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 18,
    paddingVertical: 45,
  },
  modal: {
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 15,
    padding: 24,
  },
  switchRow: {
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#3a3a3a",
  },
  servicesGrid: {
    flexDirection: "row",
    gap: 13,
    flexWrap: "wrap",
    marginVertical: 20,
  },
  serviceCard: {
    width: "47.5%",
    padding: 20,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 12,
    backgroundColor: "#242424",
  },
  serviceIcon: { fontSize: 34, color: "#f3f3f1", marginVertical: 8 },
});
