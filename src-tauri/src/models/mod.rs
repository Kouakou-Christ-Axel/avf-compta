pub mod client;
pub mod depense;
pub mod mode_paiement;
pub mod note;
pub mod paiement;
pub mod parametres;
pub mod prestation;
pub mod recu;
pub mod stats;

pub use client::{Client, ClientResume, NewClient};
pub use depense::{Depense, DepenseLigne, NewDepense};
pub use mode_paiement::ModePaiement;
pub use note::{NewNote, NoteDeFrais, NoteDetail, NoteLigne, NoteResume};
pub use paiement::{NewPaiement, Paiement, SoldeNote};
pub use parametres::Parametres;
pub use prestation::{NewPrestation, Prestation};
pub use recu::{Recu, RecuDetail, RecuResume};
pub use stats::{ResumeStats, StatMois};
