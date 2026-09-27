using System;
using System.Collections.Generic;
using UnityEngine;

namespace EduAI.Court.Core
{
    // Local spatial metadata only. The server chooses roleId/seatId; this map
    // never grants actions or determines who is legally required to attend.
    public sealed class CourtSeatLayout : MonoBehaviour
    {
        public sealed class Seat
        {
            public string Id { get; }
            private readonly string[] roles;
            public Transform CameraAnchor { get; }
            public Transform StandAnchor { get; }
            public Transform InteractionAnchor { get; }
            public Transform AccessibilityAnchor { get; }
            public Transform AnimationAnchor { get; }
            internal Seat(Transform root, string id, Vector3 position, params string[] supportedRoles)
            {
                Id = id; roles = (string[])supportedRoles.Clone();
                var seatRoot = new GameObject(id).transform;
                seatRoot.SetParent(root, false); seatRoot.position = position;
                AnimationAnchor = Anchor(seatRoot, "AnimationAnchor", Vector3.zero);
                StandAnchor = Anchor(seatRoot, "StandAnchor", new Vector3(0, -.9f, -.8f));
                InteractionAnchor = Anchor(seatRoot, "InteractionAnchor", new Vector3(0, .5f, 0));
                CameraAnchor = Anchor(seatRoot, "CameraAnchor", new Vector3(0, .65f, -.8f));
                AccessibilityAnchor = Anchor(seatRoot, "AccessibilityAnchor", new Vector3(0, -.9f, -1.4f));
            }
            public bool Supports(string role) => Array.IndexOf(roles, role) >= 0;
            private static Transform Anchor(Transform parent, string name, Vector3 offset)
            {
                var anchor = new GameObject(name).transform;
                anchor.SetParent(parent, false); anchor.localPosition = offset;
                return anchor;
            }
        }
        private readonly Dictionary<string, Seat> seats = new Dictionary<string, Seat>(StringComparer.Ordinal);
        public static CourtSeatLayout Active { get; private set; }
        public static CourtSeatLayout Ensure()
        {
            if (!Active) Active = new GameObject("CourtSeatLayout").AddComponent<CourtSeatLayout>();
            return Active;
        }
        private void Awake()
        {
            Active = this;
            Add("judge-seat", new Vector3(0, 1, 9.1f), "judge");
            Add("claimant-seat", new Vector3(3, 1, 3.5f), "claimant");
            Add("prosecutor-seat", new Vector3(3, 1, 3.5f), "prosecutor");
            Add("investigator-seat", new Vector3(3, 1, 3.5f), "investigator");
            Add("counsel-seat", new Vector3(-3, 1, 3.5f), "counsel", "assistant", "respondentCounsel");
            Add("respondent-seat", new Vector3(-5, 1, 4.8f), "respondent", "juvenile");
            Add("witness-seat", new Vector3(5, 1, 7.2f), "witness");
        }
        private void Add(string id, Vector3 position, params string[] roles)
            => seats.Add(id, new Seat(transform, id, position, roles));
        public bool TryResolve(string id, string role, out Seat seat)
        {
            seat = null;
            if (id == null || role == null || !seats.TryGetValue(id, out var found) || !found.Supports(role)) return false;
            seat = found; return true;
        }
        private void OnDestroy() { if (Active == this) Active = null; }
    }
}
