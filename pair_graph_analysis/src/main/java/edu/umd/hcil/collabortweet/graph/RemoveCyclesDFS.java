package edu.umd.hcil.collabortweet.graph;

import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.Graphs;
import org.graphstream.graph.implementations.SingleGraph;
import org.graphstream.stream.file.*;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;


/**
 * Created by cbuntain on 5/4/17.
 */
public class RemoveCyclesDFS {

    public static void main(String[] args) {

        int iterCount = Integer.parseInt(args[2]);

        Graph g = new SingleGraph("PairGraph");
        FileSource fs = new FileSourceGEXF();

        fs.addSink(g);

        try {
            String graphPath = args[0];

            System.out.println(String.format("Reading File: %s", graphPath));

            fs.readAll(graphPath);

            System.out.println("Read successful.");
        } catch( IOException e) {
            e.printStackTrace();
        } finally {
            fs.removeSink(g);
        }

        System.out.println(String.format("Node Count: %d", g.getNodeCount()));
        System.out.println(String.format("Edge Count: %d", g.getEdgeCount()));

        // How many edges did we originally have
        int origEdgeCount = g.getEdgeCount();

        Graph minGraph = null;
        int minArcSetSize = Integer.MAX_VALUE;
        for ( int i=0; i<iterCount; i++ ) {
            Graph acyclic = createAcyclicGraph(g);

            System.out.println(String.format("Node Count: %d", acyclic.getNodeCount()));
            System.out.println(String.format("Edge Count: %d", acyclic.getEdgeCount()));

            int thisEdgeCount = acyclic.getEdgeCount();

            int thisFASSize = origEdgeCount - thisEdgeCount;

            System.out.println("Feedback Arc Set Size: " + thisFASSize);

            if ( thisFASSize < minArcSetSize ) {
                minGraph = acyclic;
                minArcSetSize = thisFASSize;
            }
        }

        System.out.println("Minimum FAS Size: " + minArcSetSize);

        FileSink outSink = new FileSinkGEXF2();

        try {
            String outPath = args[1];

            System.out.println(String.format("Writing to File: %s", outPath));

            outSink.writeAll(minGraph, outPath);

            System.out.println("Write successful.");
        } catch( IOException e) {
            e.printStackTrace();
        } finally {
            fs.removeSink(g);
        }
    }

    public static Graph createAcyclicGraph(Graph originalG) {

        // Implement the BergerShorFAS algorithm as described in
        // M. Simpson, V. Srinivasan, and A. Thomo,
        // “Efficient Computation of Feedback Arc Set at Web-scale,”
        // Proc. VLDB Endow., vol. 10, no. 3, pp. 133–144, Nov. 2016.

        // Clone the graph, so edge deletion is non-destructive
        Graph g = Graphs.clone(originalG);

        // Shuffle the list
        List<Node> nodeList = new ArrayList<Node>(g.getNodeSet());
        Collections.shuffle(nodeList);

        // For each node in the list, keep either the incoming or outgoing edges,
        //  whichever is the larger set
        Set<EdgeTuple> keptEdges = new HashSet<>();

        // Track nodes we've visited
        List<String> visited = new ArrayList<>();

        // Iterate through the nodes
        for ( Node n : nodeList ) {
            Collection<Edge> outgoingEdges = n.getLeavingEdgeSet();
            outgoingEdges.removeIf(e -> e == null);

            Collection<Edge> incomingEdges = n.getEnteringEdgeSet();
            incomingEdges.removeIf(e -> e == null);

            int outgoingEdgeCount = outgoingEdges.size();
            int incomingEdgeCount = incomingEdges.size();

            // Check if we someone retouch a node we've visited before
            List<String> adj = new ArrayList<>();
            adj.addAll(outgoingEdges.stream().map(e -> e.getTargetNode().getId()).collect(Collectors.toList()));
            adj.addAll(incomingEdges.stream().map(e -> e.getSourceNode().getId()).collect(Collectors.toList()));
            List<String> tmpVis = new ArrayList<>(visited);
            tmpVis.retainAll(adj);

            if ( tmpVis.size() > 0) {
                System.out.println("ERROR. Edges should have been deleted");
                System.exit(-1);
            }

            // Keep the largest set of directions
            if ( incomingEdgeCount > outgoingEdgeCount ) {    // Keep incoming edges

                keptEdges.addAll(incomingEdges.
                        parallelStream().
                        map(e -> new EdgeTuple(e.getSourceNode().getId(), e.getTargetNode().getId()))
                            .collect(Collectors.toSet()));

            } else { // Keep outgoing edges

                keptEdges.addAll(outgoingEdges.
                        parallelStream().
                        map(e -> new EdgeTuple(e.getSourceNode().getId(), e.getTargetNode().getId()))
                        .collect(Collectors.toSet()));
            }

            // Mark this ID as visited
            visited.add(n.getId());

            // Remove all edges from the graph
            g.removeNode(n);
        }

        // Create a new graph with no error checking and activated auto-node-creation
        Graph acyclicGraph = new SingleGraph("Acyclic", false, true);
        for ( EdgeTuple e : keptEdges ) {
            String sourceId = e.left;
            String destId = e.right;
            String edgeId = String.format("%s->%s", sourceId, destId);

            acyclicGraph.addEdge(edgeId, sourceId, destId, true);
        }

        return acyclicGraph;
    }

    private static class EdgeTuple implements Comparable<EdgeTuple> {
        private String left;
        private String right;

        public EdgeTuple(String l, String r) {
            left = l;
            right = r;
        }

        public EdgeTuple(Edge e) {
            left = e.getSourceNode().getId();
            right = e.getTargetNode().getId();
        }

        public String getId() {
            return String.format("%s->%s", left, right);
        }

        @Override
        public String toString() {
            return this.getId();
        }

        @Override
        public int compareTo(EdgeTuple o) {
            return this.getId().compareTo(o.getId());
        }

        @Override
        public int hashCode() {
            return this.getId().hashCode();
        }

        @Override
        public boolean equals(Object o) {
            return o.getClass().isInstance(this.getClass()) ? o.hashCode() == this.hashCode() : false;
        }
    }
}
