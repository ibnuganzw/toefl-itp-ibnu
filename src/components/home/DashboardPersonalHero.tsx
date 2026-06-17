import { Button } from "../ui/Button";

export function DashboardPersonalHero({
  onExplore,
  onStartSimulation,
}: {
  onExplore: () => void;
  onStartSimulation: () => void;
}) {
  return (
    <section className="personalLearningHero arcane-hero arcane-card" aria-labelledby="personal-learning-title">
      <div className="personalLearningHeroCopy arcane-hero-content">
        <p className="arcane-kicker">Ruang belajar TOEFL ITP milikmu</p>
        <h1 className="arcane-hero-title" id="personal-learning-title">
          <span>Rumah bagi Para Pembelajar.</span>
          <span>Panggung bagi Para Pejuang Skor.</span>
        </h1>
        <span className="personalLearningHeroRule" aria-hidden="true" />
        <span className="arcane-hero-description">
          Entah Anda ingin membangun dasar atau mengejar target skor, semua dapat dimulai dari latihan yang tepat.
        </span>
        <div className="personalLearningHeroActions arcane-hero-actions">
          <Button icon="sparkles" variant="secondary" type="button" onClick={onExplore}>
            Jelajahi Materi
          </Button>
          <Button icon="simulation" variant="primary" type="button" onClick={onStartSimulation}>
            Mulai Simulasi
          </Button>
        </div>
      </div>
    </section>
  );
}
