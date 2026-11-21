:- module(plan_allocations, [day_number/2, iso_day/2, simulate/5, used/5]).
:- use_module(library(date)).

% Even ticks are start-of-day deadlines, odd ticks are end-of-day receipts.
day_number(date(Y,M,D), N) :-
    date_time_stamp(date(Y,M,D,0,0,0,0,-,-),Stamp), N is round(Stamp/86400).
iso_day(N, Text) :-
    Stamp is N*86400, stamp_utc(Stamp,Text).
% Use UTC explicitly, independently of the host timezone.
stamp_utc(Stamp,Text) :-
    stamp_date_time(Stamp,Date,'UTC'), format_time(string(Text),'%F',Date).

% Visit deadlines and supply events in chronological order. A late withdrawal
% is feasible only if the remaining lots still cover the protected deadlines.
% This releases early stock when a later receipt can cover tomorrow instead.
simulate(Needs, Recipes, Lots, Final, Missing) :-
    sort(Lots,Ordered), Initial=state(Ordered,[],[]),
    findall(T,(member(need(T,_,_),Needs);member(lot(T,_,_,_,_),Ordered)),Events),
    sort(Events,Calendar), walk(Calendar,Needs,Recipes,Initial,[],Final,Missing).

walk([],_,_,State,Missing,State,Missing).
walk([T|Ts],Needs,Recipes,State,Backlog,Final,Missing) :-
    partition(due_at(T),Needs,Today,Future),
    foldl(on_time(Recipes),Today,acc(State,[]),acc(Current,New)),
    reverse(New,NewBacklog),append(Backlog,NewBacklog,Outstanding),
    late_rows(Outstanding,Recipes,T,Future,Current,Next,Rest),
    walk(Ts,Future,Recipes,Next,Rest,Final,Missing).
due_at(T,need(T,_,_)).

on_time(R,need(D,P,Q),acc(S,Missing),acc(Next,Rest)) :-
    serve(R,D,P,Q,D,S,Next,Left),
    (Left>0 -> Rest=[need(D,P,Left)|Missing] ; Rest=Missing).

late_rows([],_,_,_,S,S,[]).
late_rows([need(D,P,Q)|Ns],R,T,Future,S,Final,Rest) :-
    ( T=<D -> Next=S, Left=Q
    ; Future=[] -> serve(R,D,P,Q,T,S,Next,Left)
    ; protected_shortages(Future,R,S,Baseline),
      feasible_quantity(protected_take(P,D,T,R,S,Future,Baseline),Q,N,After),
      record_service(After,D,P,T,N,Next), Left is Q-N ),
    (Left>0 -> Rest=[need(D,P,Left)|More] ; Rest=More),
    late_rows(Ns,R,T,Future,Next,Final,More).

protected_shortages(Future,R,S,Missing) :-
    foldl(on_time(R),Future,acc(S,[]),acc(_,Missing)).
protected_take(P,D,T,R,S,Future,Baseline,N,After) :-
    take(N,P,D,T,R,S,After), protected_shortages(Future,R,After,Missing),
    forall(member(need(Day,Item,Qty),Missing),
           (memberchk(need(Day,Item,Old),Baseline),Qty=<Old)).

serve(R,D,P,Q,T,S,Next,Left) :-
    feasible_quantity(take_from(P,D,T,R,S),Q,N,Full),
    record_service(Full,D,P,T,N,Next), Left is Q-N.
record_service(state(Lots,Uses,Batches),D,P,T,N,state(Lots,[served(D,P,T,N)|Uses],Batches)).
take_from(P,D,T,R,S,Q,Next) :- take(Q,P,D,T,R,S,Next).

feasible_quantity(Apply,Q,N,State) :-
    (call(Apply,Q,Full) -> N=Q,State=Full
    ; largest(0,Q,Apply,N),call(Apply,N,State)).
largest(L,H,Apply,N) :-
    ( H-L=<1 -> N=L
    ; M is (L+H)//2,
      (call(Apply,M,_) -> largest(M,H,Apply,N)
      ; largest(L,M,Apply,N)) ).

take(Q,P,D,T,R,S,Next) :- take_for(Q,P,D,T,R,demand,S,Next).
take_for(0,_,_,_,_,_,S,S) :- !.
take_for(Q,P,D,T,R,Target,state(Lots,Uses,Batches),Final) :-
    withdraw(Lots,Q,P,D,T,Target,Uses,NewLots,Remaining,NewUses),
    ( Remaining=:=0 -> Final=state(NewLots,NewUses,Batches)
    ; memberchk(recipe(P,Y,Ingredients),R), Count is (Remaining+Y-1)//Y,
      foldl(ingredient_use(Count,D,T,R,Id),Ingredients,state(NewLots,NewUses,Batches),state(After,AllUses,Prior)),
      length(Prior,Index), format(string(Id),'~w/b~d',[P,Index]),
      % Production occurs at this planning event, after its ingredients
      % have been allocated. No lead time is configured for preparation.
      Total is Count*Y, Surplus is Total-Remaining,
      Synth=lot(T,3,P,json{batchId:Id},Surplus), msort([Synth|After],Available),
      Final=state(Available,[use(D,P,T,T,3,json{batchId:Id},Remaining,Target)|AllUses],
                  [batch(Id,P,T,Total)|Prior]) ).
ingredient_use(Count,D,T,R,BatchId,ingredient(P,N),Before,After) :-
    Q is Count*N, take_for(Q,P,D,T,R,batch(BatchId),Before,After).

withdraw([],Q,_,_,_,_,U,[],Q,U).
withdraw([L|Ls],Q,_,_,T,_,U,Result,Remaining,Uses) :-
    L=lot(A,K,Item,Ref,N),
    ( Q=:=0 ; A>T ), !, Result=[lot(A,K,Item,Ref,N)|Ls], Remaining=Q, Uses=U.
withdraw([lot(A,K,Item,Ref,N)|Ls],Q,P,D,T,Target,U,Result,Remaining,Uses) :-
    ( Item==P, N>0 ->
      V is min(Q,N), Left is N-V, Next is Q-V, U1=[use(D,P,T,A,K,Ref,V,Target)|U],
      (Left>0 -> Result=[lot(A,K,P,Ref,Left)|More] ; Result=More)
    ; Result=[lot(A,K,Item,Ref,N)|More], Next=Q,U1=U ),
    withdraw(Ls,Next,P,D,T,Target,U1,More,Remaining,Uses).
used(Uses,D,P,T,Q) :- member(use(D,P,T,_,_,_,Q,_),Uses).
