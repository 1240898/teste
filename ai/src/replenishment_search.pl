:- module(replenishment_search,[best_schedule/6, options/5, choose_best/3, line_lot/2, score_purchase/3]).
:- use_module(plan_allocations).
:- use_module(library(aggregate)).
:- meta_predicate choose_best(2,-,-).

% A request-local incumbent avoids materialising the Cartesian product.
choose_best(Generate, Score, Value) :-
    Cell=best(none,none),
    forall(call(Generate,K,V),
        (arg(1,Cell,Old), (Old==none ; K@<Old) ->
         nb_setarg(1,Cell,K),nb_setarg(2,Cell,V) ; true)),
    arg(1,Cell,Score), Score\==none, arg(2,Cell,Value).

best_schedule(P,Needs,Offers,Ref,Lots,Lines) :-
    include(lot_for(P),Lots,Own),
    service_score(P,Needs,Own,[],Baseline),
    ( Baseline=service(_,0,0) -> Lines=[]
    ; aggregate_all(sum(N),member(need(_,P,N),Needs),Demand),
      aggregate_all(sum(N),member(lot(_,0,P,_,N),Own),Opening),
      Bound is max(0,Demand-Opening),
      ordered_offers(P,Offers,Sorted),
      choose_best(single(P,Needs,Bound,Sorted,Ref,Own),_,Lines) ).
lot_for(P,lot(_,_,P,_,_)).

single(_,_,_,[],_,_,k(0),[]) :- !.
single(P,Needs,Bound,Offers,Ref,Lots,Key,Lines) :-
    append(Prefix,[Last],Offers),
    pack_budget(Offers,Bound,Budget),
    offer_counts(Prefix,Bound,Budget,Ref,Earlier,Remaining),
    limits(Last,Bound,Cap,Upper), Last=offer(_,_,_,Units,_,_,_),
    Max is min(Upper,Remaining//Units),
    % For a fixed prefix more packs of the last offer cannot worsen service.
    % Binary search the first count on the best attainable service plateau.
    evaluate_count(Max,Last,Cap,Ref,Earlier,P,Needs,Lots,Target,_),
    first_count(0,Max,Last,Cap,Ref,Earlier,P,Needs,Lots,Target,Count),
    evaluate_count(Count,Last,Cap,Ref,Earlier,P,Needs,Lots,Target,Lines),
    score_purchase(Lines,Cost,Quantity), sort(Lines,Stable), Key=k(Target,Cost,Quantity,Stable).
first_count(L,H,O,Cap,Ref,Prefix,P,Needs,Lots,Target,N) :-
    ( L>=H -> N=L
    ; M is (L+H)//2, evaluate_count(M,O,Cap,Ref,Prefix,P,Needs,Lots,Service,_),
      ( Service==Target -> first_count(L,M,O,Cap,Ref,Prefix,P,Needs,Lots,Target,N)
      ; Next is M+1, first_count(Next,H,O,Cap,Ref,Prefix,P,Needs,Lots,Target,N)) ).
evaluate_count(N,offer(S,P,C,U,L,Limit,_),Cap,Ref,Prefix,P,Needs,Lots,Service,Lines) :-
    place(N,Cap,S,P,C,U,L,Limit,Ref,Last,[]),append(Prefix,Last,Lines),
    service_score(P,Needs,Lots,Lines,Service).
service_score(P,Needs,Lots,Lines,service(Neg,Lost,Delay)) :-
    maplist(line_lot,Lines,New), append(Lots,New,Supply),
    simulate(Needs,[],Supply,state(_,Uses,_),Missing),
    aggregate_all(sum(Q),(used(Uses,D,P,T,Q),T=<D),Timely),
    aggregate_all(sum(Q),member(need(_,_,Q),Missing),Lost),
    aggregate_all(sum(W),(used(Uses,D,P,T,Q),W is Q*max(0,T-D)),Delay),
    Neg is -Timely.

options(P,Needs,Offers,Ref,Lines) :-
    aggregate_all(sum(Q),member(need(_,P,Q),Needs),Bound),
    ordered_offers(P,Offers,Sorted),
    pack_budget(Sorted,Bound,Budget),offer_counts(Sorted,Bound,Budget,Ref,Lines,_).
ordered_offers(P,Offers,Sorted) :-
    include(for_product(P),Offers,Selected),
    % Exact ratios guide enumeration. The decision itself uses whole-pack cost.
    map_list_to_pairs(offer_key,Selected,Pairs),keysort(Pairs,Ordered),pairs_values(Ordered,Sorted).
offer_key(Offer,key(NegPack,Rate,Offer)) :-
    Offer=offer(_,_,C,U,_,_,_), NegPack is -U, Rate is C rdiv U.
for_product(P,offer(_,P,_,_,_,_,_)).
% If total purchases exceed demand by a whole largest pack, removing
% the last-arriving pack preserves every deadline and reduces surplus.
pack_budget(Offers,Bound,Budget) :-
    findall(U,member(offer(_,_,_,U,_,_,_),Offers),Units),
    max_list([1|Units],Largest),Budget is Bound+Largest-1.
offer_counts([],_,Remaining,_,[],Remaining).
offer_counts([Offer|Os],Bound,Budget,Ref,Lines,Remaining) :-
    Offer=offer(S,P,C,U,L,Limit,_), limits(Offer,Bound,Cap,Upper),
    Max is min(Upper,Budget//U), between(0,Max,Count), NextBudget is Budget-Count*U,
    place(Count,Cap,S,P,C,U,L,Limit,Ref,Lines,Tail),
    offer_counts(Os,Bound,NextBudget,Ref,Tail,Remaining).

limits(offer(_,_,_,U,_,Limit,_),Bound,Cap,Max) :-
    Upper is (Bound+U-1)//U,
    (Limit==none -> Cap=Upper ; Cap is Limit//U),
    (Cap=:=0 -> Max=0 ; Max=Upper).

% With no holding charge or global supplier cap, moving a chosen pack
% earlier can only enlarge the set of feasible allocations.
place(0,_,_,_,_,_,_,_,_,Tail,Tail) :- !.
place(N,Cap,S,P,C,U,L,Limit,D,[line(S,P,D,Arrival,Count,Qty,Cost,Limit)|Ls],Tail) :-
    Count is min(N,Cap), Qty is U*Count, Cost is C*Count, Arrival is D+L,
    Left is N-Count, Tomorrow is D+1, place(Left,Cap,S,P,C,U,L,Limit,Tomorrow,Ls,Tail).
score_purchase(Lines,C,Q) :-
    aggregate_all(sum(V),member(line(_,_,_,_,_,_,V,_),Lines),C),
    aggregate_all(sum(N),member(line(_,_,_,_,_,N,_,_),Lines),Q).
line_lot(line(S,P,D,A,_,Q,_,_),lot(T,2,P,json{lineId:Id},Q)) :-
    T is 2*A+1, format(string(Id),'~q',[line(S,P,D)]).
