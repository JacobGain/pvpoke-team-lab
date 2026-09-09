# 1.0.1 — Mobile Pokémon selection fix

TeamLab 1.0.1 fixes Pokémon selection from the Add Pokémon autocomplete on
touch devices, including iPhone Safari.

On touch browsers, moving focus away from the search field could close the
suggestion list before the delayed click event selected the tapped result.
Suggestions now select during the touch pointer press while mouse and keyboard
activation retain their existing behavior.

Inventory, saved-team, backup, and database schemas are unchanged from 1.0.0.
