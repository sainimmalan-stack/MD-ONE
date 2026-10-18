"use client";
import {
  ArrowUpRight,
  CarFront,
  ShoppingBag,
  BookOpen,
  Armchair,
  Users,
} from "lucide-react";
import "./community-highlights.css";
export function CommunityHighlights({ go }: { go: (tab: string) => void }) {
  return (
    <nav className="community-highlights" aria-label="Community highlights">
      <button
        className="community-highlight exchange-highlight"
        onClick={() => go("exchange")}
      >
        <div className="community-highlight-copy">
          <span className="community-highlight-label">
            <ShoppingBag size={15} />
            The neighbourhood exchange
          </span>
          <h2>
            Marketplace<span>.</span>
          </h2>
          <p>
            Buy, sell or find your next home.
            <br />
            Items, rentals and owner-listed flats.
          </p>
          <span className="community-highlight-action">
            Open marketplace <ArrowUpRight size={17} />
          </span>
        </div>
        <div
          className="community-highlight-art exchange-highlight-art"
          aria-hidden="true"
        >
          <Armchair className="highlight-chair" strokeWidth={1.15} />
          <BookOpen className="highlight-books" strokeWidth={1.2} />
          <span className="highlight-art-caption">Closer to home.</span>
        </div>
      </button>
      <button
        className="community-highlight carpool-highlight"
        onClick={() => go("carpool")}
      >
        <div className="community-highlight-copy">
          <span className="community-highlight-label">
            <Users size={15} />
            Residents going your way
          </span>
          <h2>
            Carpool<span>.</span>
          </h2>
          <p>
            A shared direction. A familiar face.
            <br />
            Find a journey or offer your own.
          </p>
          <span className="community-highlight-action">
            Explore rides <ArrowUpRight size={17} />
          </span>
        </div>
        <div
          className="community-highlight-art carpool-highlight-art"
          aria-hidden="true"
        >
          <span className="highlight-route" />
          <CarFront strokeWidth={1} />
          <span className="highlight-art-caption">
            Connect. Then go together.
          </span>
        </div>
      </button>
    </nav>
  );
}
