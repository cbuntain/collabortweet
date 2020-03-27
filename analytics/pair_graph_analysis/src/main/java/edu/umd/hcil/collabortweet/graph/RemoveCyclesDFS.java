package edu.umd.hcil.collabortweet.graph;

import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.Graphs;
import org.graphstream.graph.implementations.SingleGraph;
import org.graphstream.stream.file.FileSink;
import org.graphstream.stream.file.FileSinkGEXF2;
import org.graphstream.stream.file.FileSource;
import org.graphstream.stream.file.FileSourceGEXF;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;


/**
 * Created by cbuntain on 5/4/17.
 */
public class RemoveCyclesDFS {

    public static void main(String[] args) {

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

//        g.display(true);

//        EdgeTuple x = new EdgeTuple("123", "456");
//        System.out.println(x);
//        System.out.println(x.getId());
//        System.out.println(x.hashCode());
//        EdgeTuple y = new EdgeTuple("123", "456");
//        System.out.println(y);
//        System.out.println(y.getId());
//        System.out.println(y.hashCode());
//
//        System.out.println("Equals: " + x.equals(y));
//
//        Set<EdgeTuple> m = new HashSet<>();
//        System.out.println("After INIT:");
//        m.forEach(et -> System.out.println(et));
//        m.add(x);
//        System.out.println("After X:");
//        m.forEach(et -> System.out.println(et));
//        m.add(y);
//        System.out.println("After Y:");
//        m.forEach(et -> System.out.println(et));
//        System.exit(1);

        System.out.println(String.format("Node Count: %d", g.getNodeCount()));
        System.out.println(String.format("Edge Count: %d", g.getEdgeCount()));

        // How many edges did we originally have
        int origEdgeCount = g.getEdgeCount();

        Graph acyclic = createAcyclicGraph(g);

        System.out.println(String.format("Node Count: %d", acyclic.getNodeCount()));
        System.out.println(String.format("Edge Count: %d", acyclic.getEdgeCount()));

        int thisEdgeCount = acyclic.getEdgeCount();

        int thisFASSize = origEdgeCount - thisEdgeCount;

        System.out.println("Feedback Arc Set Size: " + thisFASSize);

        System.out.println("Minimum FAS Size: " + thisFASSize);

        FileSink outSink = new FileSinkGEXF2();

        try {
            String outPath = args[1];

            System.out.println(String.format("Writing to File: %s", outPath));

            outSink.writeAll(acyclic, outPath);

            System.out.println("Write successful.");
        } catch( IOException e) {
            e.printStackTrace();
        } finally {
            fs.removeSink(g);
        }
    }

    public static Graph createAcyclicGraph(Graph g) {

        // Find a maximal acyclic arc set from each node
//        List<List<EdgeTuple>> arcSets = g.getNodeSet().stream().map(node -> {
//            Set<String> originSet = new HashSet<String>();
//            originSet.add(node.getId());
//
//            return recursiveDfs(node, originSet, 0);
//        }).collect(Collectors.toList());
        List<Set<EdgeTuple>> arcSets = new ArrayList<>();
        for ( Node node : g.getNodeSet() ) {
            Set<String> originSet = new HashSet<>();
            originSet.add(node.getId());

            Set<EdgeTuple> badEdges = recursiveDfs(node, originSet, 0);
            arcSets.add(badEdges);

            System.out.println("Does node [" + node + "] Have cycles: " + badEdges.size());
            badEdges.forEach(et -> System.out.println(et));
        }

        // Find the min set size
        int minSetSize = Integer.MAX_VALUE;
        Set<EdgeTuple> minArcSet = null;
        for ( Set<EdgeTuple> acyclicArcSet : arcSets ) {
            int setSize = acyclicArcSet.size();
            if ( setSize < minSetSize ) {
                minSetSize = setSize;
                minArcSet = acyclicArcSet;
            }
        }

        System.out.println("Minimum Feedback Arc Set Size: " + minSetSize);

        // Create a new graph with no error checking and activated auto-node-creation
        Graph acyclicGraph = new SingleGraph("Acyclic", false, true);
//        for ( EdgeTuple e : maxArcSet ) {
//            String sourceId = e.getLeftId();
//            String destId = e.getRightId();
//            String edgeId = String.format("%s->%s", sourceId, destId);
//
//            acyclicGraph.addEdge(edgeId, sourceId, destId, true);
//        }

        return acyclicGraph;
    }

    private static Set<EdgeTuple> recursiveDfs(Node origin, Set<String> visited, int depth) {

//        for ( int i=0; i<depth; i++ ) {
//            System.out.print("\t");
//        }
//        System.out.println("Depth: " + depth + ", Starting from node: " + origin.toString());

        List<Edge> outgoingEdges = origin.getLeavingEdgeSet().stream().
                filter(e -> !visited.contains(e.getTargetNode().getId())).collect(Collectors.toList());

        if ( outgoingEdges.size() == 0 ) {
            return new HashSet<>();
        }

        List<Set<EdgeTuple>> badEdgeList = new ArrayList<>();
        for ( Edge e : origin.getLeavingEdgeSet() ) {
            Set<EdgeTuple> badEdges = new HashSet<>();

            Node target = e.getTargetNode();

            // If we have not visited this node before, keep this edge, and
            //  traverse this node
            if ( !visited.contains(target.getId()) ) {

                Set<String> localVisited = new HashSet<>(visited);
                localVisited.add(target.getId());

                // Add all further bad edges
                badEdges.addAll(recursiveDfs(target, localVisited, depth + 1));
            } else {
//                System.out.println("Edge Would Have Induced Cycle: " + e.toString());
                badEdges.add(new EdgeTuple(e));
            }

            badEdgeList.add(badEdges);
        }

        int minBadEdgeCount = Integer.MAX_VALUE;
        Set<EdgeTuple> minBadEdges = null;
        for ( Set<EdgeTuple> cycleEdges : badEdgeList ) {
            int localDelCount = cycleEdges.size();

            if ( localDelCount == 0 ) {
                continue;
            }

            if ( localDelCount < minBadEdgeCount ) {
                minBadEdgeCount = localDelCount;
                minBadEdges = cycleEdges;
            }
        }

        return minBadEdges;
    }

}
